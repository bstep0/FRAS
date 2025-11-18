from flask import Flask, request, jsonify, Response, stream_with_context
import base64
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth as firebase_auth
import datetime
import ipaddress
import os
from deepface import DeepFace
from zoneinfo import ZoneInfo
import csv
import io

from ipaddress import ip_address, ip_network

try:
    from .allowed_networks import UNT_EAGLENET_NETWORKS
except ImportError:  # pragma: no cover - fallback for script execution
    from allowed_networks import UNT_EAGLENET_NETWORKS


# ------------------------------
# Network allowlist configuration
# ------------------------------
# Home LAN networks are intentionally narrow. Override HOME_CIDR_STRINGS or
# HOME_CIDRS with a comma-separated list (e.g., "192.168.1.70/32,2600:abcd::/64")
# when running demos off-campus. Production should rely on the UNT EagleNet
# ranges from allowed_networks.py.
DEFAULT_HOME_CIDR_STRINGS = ("192.168.1.70/32",)


def _get_home_cidr_strings():
    env_value = os.environ.get("HOME_CIDR_STRINGS") or os.environ.get("HOME_CIDRS")
    if env_value:
        cidr_strings = [cidr.strip() for cidr in env_value.split(",") if cidr.strip()]
        if cidr_strings:
            return tuple(cidr_strings)

    return DEFAULT_HOME_CIDR_STRINGS


def refresh_allowed_networks():
    global HOME_NETWORKS, ALLOWED_IP_NETWORKS

    HOME_NETWORKS = tuple(ip_network(cidr) for cidr in _get_home_cidr_strings())
    ALLOWED_IP_NETWORKS = UNT_EAGLENET_NETWORKS + HOME_NETWORKS


refresh_allowed_networks()


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "https://csce-4095---it-capstone-i.web.app"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase/firebase_credentials.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": "csce-4095---it-capstone-i.firebasestorage.app",
})
db = firestore.client()
bucket = storage.bucket()

# Timezone for Central Time
CENTRAL_TZ = ZoneInfo("America/Chicago")

# How long pending records should wait before recheck (for logging & UI)
# You can change this for testing, or set env var PENDING_VERIFICATION_MINUTES.
PENDING_RECHECK_MINUTES = int(os.environ.get("PENDING_VERIFICATION_MINUTES", "45"))


def _to_central_iso(timestamp_like):
    """Return an ISO 8601 string in Central time for datetime inputs."""

    if isinstance(timestamp_like, datetime.datetime):
        timestamp = timestamp_like
    elif isinstance(timestamp_like, datetime.date):
        timestamp = datetime.datetime.combine(timestamp_like, datetime.time.min)
    else:
        return None

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
    return timestamp.astimezone(CENTRAL_TZ).isoformat()


def _get_class_document(class_id):
    """Fetch a class document by ID."""
    class_ref = db.collection("classes").document(class_id)
    class_doc = class_ref.get()
    if not class_doc.exists:
        return None
    data = class_doc.to_dict()
    data["id"] = class_doc.id
    return data


def _get_teacher_profile(teacher_id=None, teacher_email=None):
    """Fetch minimal teacher profile for display."""
    users_collection = db.collection("users")

    if teacher_id:
        try:
            doc_ref = users_collection.document(teacher_id)
            snapshot = doc_ref.get()
        except Exception:
            snapshot = None
        else:
            if snapshot and getattr(snapshot, "exists", False):
                profile = snapshot.to_dict() or {}
                doc_id = getattr(snapshot, "id", None) or getattr(doc_ref, "id", None) or teacher_id
                return doc_id, profile

    if teacher_email:
        try:
            query = users_collection.where("email", "==", teacher_email).limit(1)
            snapshot = next(query.stream(), None)
        except Exception:
            snapshot = None
        else:
            if snapshot and getattr(snapshot, "exists", False):
                profile = snapshot.to_dict() or {}
                doc_id = getattr(snapshot, "id", None) or getattr(snapshot, "id", None)
                return doc_id, profile

    return None, None


def _get_attendance_collection():
    return db.collection("attendance")


def _fetch_pending_attendance_records(cutoff_minutes=PENDING_RECHECK_MINUTES):
    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(minutes=cutoff_minutes)

    attendance_collection = _get_attendance_collection()
    query = attendance_collection.where("isPending", "==", True).where("scanTimestamp", "<=", cutoff)
    return list(query.stream())


def _finalize_pending_record(record_snapshot):
    record = record_snapshot.to_dict()
    record_id = record_snapshot.id

    scan_status = record.get("scanStatus")
    pending_status = record.get("pendingStatus")
    student_id = record.get("studentId") or record.get("studentID")
    class_id = record.get("classId")
    scan_timestamp = record.get("scanTimestamp")

    updates = {
        "isPending": False,
        "finalizedAt": datetime.datetime.now(datetime.timezone.utc),
    }

    if pending_status == "present":
        updates["scanStatus"] = "present"
    elif pending_status == "absent":
        updates["scanStatus"] = "absent"
    else:
        updates["scanStatus"] = scan_status or "unknown"

    attendance_ref = _get_attendance_collection().document(record_id)

    if "pendingStatus" in record:
        updates["pendingStatus"] = firestore.DELETE_FIELD

    if "isPending" in record:
        updates["isPending"] = firestore.DELETE_FIELD

    if "rejectionReason" in record:
        updates["rejectionReason"] = firestore.DELETE_FIELD

    attendance_ref.update(updates)

    return jsonify({
        "status": "success",
        "message": "Attendance finalized.",
        "recordId": record_id,
        "finalStatus": pending_status,
    }), 200


def _resolve_student_name(student_id):
    """Resolve student display name from 'users' collection."""
    if not student_id:
        return None

    try:
        user_ref = db.collection("users").document(student_id)
        user_snapshot = user_ref.get()
        if user_snapshot.exists:
            user_data = user_snapshot.to_dict() or {}
            return user_data.get("name") or user_data.get("fullName") or user_data.get("displayName")
    except Exception:
        pass

    return None


def _create_attendance_record(student_id, class_id, scan_status, is_pending=False, pending_status=None, rejection_reason=None):
    attendance_ref = _get_attendance_collection()
    now = datetime.datetime.now(datetime.timezone.utc)

    record_data = {
        "studentId": student_id,
        "classId": class_id,
        "scanStatus": scan_status,
        "scanTimestamp": now,
        "isPending": is_pending,
        "pendingStatus": pending_status,
        "rejectionReason": rejection_reason,
        "createdAt": now,
        "updatedAt": now,
    }

    record_ref = attendance_ref.document()
    record_ref.set(record_data)

    record_data["id"] = record_ref.id
    record_data["scanTimestampIso"] = _to_central_iso(now)

    return record_data


def _within_class_time_window(class_doc, scan_time=None):
    """
    Check if scan_time is within the scheduled class time frame.

    We assume class_doc has fields:
      - classStartTime (timestamp or datetime)
      - classEndTime   (timestamp or datetime)
    """
    if not class_doc:
        return False

    start_time = class_doc.get("classStartTime")
    end_time = class_doc.get("classEndTime")

    if scan_time is None:
        scan_time = datetime.datetime.now(datetime.timezone.utc)

    def _to_dt(value):
        if isinstance(value, datetime.datetime):
            return value
        if isinstance(value, datetime.date):
            return datetime.datetime.combine(value, datetime.time.min, tzinfo=datetime.timezone.utc)
        return None

    start_dt = _to_dt(start_time)
    end_dt = _to_dt(end_time)

    if not start_dt or not end_dt:
        return False

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=datetime.timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=datetime.timezone.utc)

    return start_dt <= scan_time <= end_dt


def get_client_ip(req):
    """Extract the best-effort client IP address from the incoming request."""
    # Prefer X-Forwarded-For if present (ngrok and proxies will set this)
    forwarded_for = req.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        for part in forwarded_for.split(","):
            ip_candidate = part.strip()
            if ip_candidate:
                return ip_candidate

    # Some proxies use X-Real-IP
    real_ip = req.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fallback to the direct remote address
    return req.remote_addr


def is_ip_allowed(ip_str):
    """
    Return True if the given IP string is in one of the allowed networks.

    Allowed sources:
      - UNT EagleNet ranges (see allowed_networks.py)
      - Home LAN ranges (HOME_CIDR_STRINGS/HOME_CIDRS; defaults to 192.168.1.70/32)
    """
    if not ip_str:
        return False
    try:
        client_ip = ip_address(ip_str)
    except ValueError:
        # Not a valid IP string
        return False

    return any(client_ip in network for network in ALLOWED_IP_NETWORKS)


def _process_face_recognition_request():
    temp_captured_path = "temp_captured_face.jpg"
    temp_known_path = "temp_known_face.jpg"

    try:
        data = request.get_json() or {}
        image_b64 = data.get("image")
        class_id = data.get("classId")
        student_id = data.get("studentId")

        if not image_b64 or not class_id or not student_id:
            return jsonify({"status": "error", "message": "Missing image, classId, or studentId"}), 400

        # Download known face image from storage
        blob = bucket.blob(f"known_faces/{student_id}.jpg")
        if not blob.exists():
            return jsonify(
                {"status": "error", "message": "No known face image found for this student."}
            ), 404
        blob.download_to_filename(temp_known_path)

        # Decode base64 image ("data:image/jpeg;base64,..." or raw base64)
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]

        try:
            image_data = base64.b64decode(image_b64)
        except Exception:
            return jsonify({"status": "error", "message": "Invalid image data."}), 400

        np_arr = np.frombuffer(image_data, np.uint8)
        captured_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if captured_img is None:
            return jsonify(
                {"status": "error", "message": "Captured image could not be decoded."}
            ), 400

        # Downscale + simple face detection
        max_dim = 640
        h, w = captured_img.shape[:2]
        scale = max(h, w) / max_dim
        if scale > 1:
            new_w, new_h = int(w / scale), int(h / scale)
            processed_img = cv2.resize(captured_img, (new_w, new_h))
        else:
            processed_img = captured_img

        gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80),
        )

        if len(faces) == 0:
            return jsonify(
                {
                    "status": "fail",
                    "message": "No face detected. Make sure your face is clearly visible to the camera.",
                }
            ), 400

        cv2.imwrite(temp_captured_path, processed_img)

        # ---------- Facial recognition with VGG-Face ----------
        try:
            verify_result = DeepFace.verify(
                img1_path=temp_captured_path,
                img2_path=temp_known_path,
                model_name="VGG-Face",
                enforce_detection=False,
            )
        except Exception:
            app.logger.exception("Face verification failed")
            return jsonify(
                {"status": "error", "message": "Face verification failed."}
            ), 502

        distance = verify_result.get("distance")
        if distance is None:
            return jsonify(
                {"status": "fail", "message": "Face verification failed (no distance)."}
            ), 400

        # Threshold for VGG-Face – tune this if needed
        INTERNAL_THRESHOLD = 0.35
        if distance > INTERNAL_THRESHOLD or not verify_result.get("verified", False):
            return jsonify(
                {"status": "fail", "message": "Face not recognized"}
            ), 404

        now_central = datetime.datetime.now(CENTRAL_TZ)
        today_str = now_central.strftime("%Y-%m-%d")
        doc_id = f"{class_id}_{student_id}_{today_str}"

        attendance_doc_ref = db.collection("attendance").document(doc_id)
        attendance_doc = attendance_doc_ref.get()

        if attendance_doc.exists:
            existing_record = attendance_doc.to_dict() or {}
            if existing_record.get("status") == "pending":
                existing_recheck_due = existing_record.get("pendingRecheckAt")
                if isinstance(existing_recheck_due, datetime.datetime):
                    existing_recheck_due_iso = existing_recheck_due.isoformat()
                else:
                    existing_recheck_due_iso = None

                return (
                    jsonify(
                        {
                            "status": "pending",
                            "message": "Attendance scan is pending verification. Please leave the webpage open until it is resolved.",
                            "recognized_student": student_id,
                            "pending": True,
                            "proposed_attendance_status": existing_record.get(
                                "proposedStatus"
                            ),
                            "recheck_due_at": existing_recheck_due_iso,
                            "recordId": doc_id,
                        }
                    ),
                    202,
                )

            return (
                jsonify(
                    {
                        "status": "already_marked",
                        "message": "Attendance already recorded today.",
                    }
                ),
                200,
            )

        class_doc = db.collection("classes").document(class_id).get()
        if not class_doc.exists:
            return jsonify({"status": "error", "message": "Class not found"}), 404

        class_data = class_doc.to_dict() or {}
        schedule_str = class_data.get("schedule", "").strip()
        if not schedule_str:
            return jsonify(
                {"status": "error", "message": "No schedule defined for this class"}
            ), 400

        start_time, end_time = parse_schedule(schedule_str)
        if not start_time or not end_time:
            return jsonify(
                {"status": "error", "message": "Invalid schedule format"}
            ), 400

        start_dt = datetime.datetime(
            now_central.year,
            now_central.month,
            now_central.day,
            start_time.hour,
            start_time.minute,
            0,
            0,
            tzinfo=CENTRAL_TZ,
        )
        end_dt = datetime.datetime(
            now_central.year,
            now_central.month,
            now_central.day,
            end_time.hour,
            end_time.minute,
            0,
            0,
            tzinfo=CENTRAL_TZ,
        )

        status, error_msg = get_attendance_status(now_central, start_dt, end_dt)
        if error_msg:
            return jsonify({"status": "fail", "message": error_msg}), 400

        network_evidence = {
            "remoteAddr": request.remote_addr,
            "xForwardedFor": request.headers.get("X-Forwarded-For"),
            "xRealIp": request.headers.get("X-Real-IP"),
            "userAgent": request.headers.get("User-Agent"),
            "forwardedProto": request.headers.get("X-Forwarded-Proto"),
            "requestId": request.headers.get("X-Request-Id"),
        }

        pending_recheck_at = now_central + datetime.timedelta(
            minutes=PENDING_RECHECK_MINUTES
        )

        attendance_record = {
            "studentID": student_id,
            "classID": class_id,
            "date": now_central,
            "status": "pending",
            "isPending": True,
            "proposedStatus": status,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "pendingRecheckAt": pending_recheck_at,
            "networkEvidence": network_evidence,
            "verification": {
                "distance": float(distance),
                "threshold": INTERNAL_THRESHOLD,
                "model": "VGG-Face",
            },
        }
        attendance_doc_ref.set(attendance_record)

        response_payload = {
            "status": "pending",
            "recognized_student": student_id,
            "pending": True,
            "proposed_attendance_status": status,
            "recheck_due_at": pending_recheck_at.isoformat(),
            "recordId": doc_id,
        }

        return jsonify(response_payload), 202

    except Exception as e:
        app.logger.exception("Unhandled error in _process_face_recognition_request")
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        for p in (temp_captured_path, temp_known_path):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass


@app.route("/api/face-recognition", methods=["POST", "OPTIONS"])
def face_recognition():
    """
    Entry point for face recognition.

    Allowed sources:
      - Requests coming through an ngrok tunnel (Host header contains "ngrok")
      - Direct requests where the client IP is in ALLOWED_IP_NETWORKS
        (UNT EagleNet or your home LAN ranges).
    """
    if request.method == "OPTIONS":
        # CORS preflight
        return "", 200

    client_ip = get_client_ip(request)
    host_header = request.headers.get("Host", "") or request.host or ""

    # Allow any request that has come through an ngrok tunnel.
    if "ngrok" in host_header.lower():
        app.logger.info(
            "Allowing face recognition from ngrok host %s (client_ip=%s)",
            host_header,
            client_ip,
        )
        return _process_face_recognition_request()

    # Otherwise, enforce strict IP allowlist (EagleNet + home LAN).
    if not is_ip_allowed(client_ip):
        app.logger.warning(
            "Rejected face recognition request from unauthorized IP %s (Host=%s)",
            client_ip,
            host_header,
        )
        return jsonify(
            {
                "status": "forbidden",
                "message": "Access denied: client IP is not authorized to use this service.",
            }
        ), 403

    return _process_face_recognition_request()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
