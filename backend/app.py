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
# Home LAN networks - adjust if your home network uses a different range.
HOME_CIDR_STRINGS = (
    "192.168.0.0/16",  # covers 192.168.x.x, including 192.168.1.70
    # If your ISP gives you a stable IPv6 prefix at home, you can optionally
    # add it here, for example: "2600:1702:5230:8490::/64"
)

HOME_NETWORKS = tuple(ip_network(cidr) for cidr in HOME_CIDR_STRINGS)

# Combine EagleNet networks (from allowed_networks.py) with home networks.
ALLOWED_IP_NETWORKS = UNT_EAGLENET_NETWORKS + HOME_NETWORKS


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
      - Home LAN ranges (HOME_CIDR_STRINGS)
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
    # Temporary filenames for the captured face and the known face downloaded from storage
    temp_captured_path = "temp_captured_face.jpg"
    temp_known_path = "temp_known_face.jpg"

    try:
        data = request.get_json()
        image_b64 = data.get("image")
        class_id = data.get("classId")
        student_id = data.get("studentId")

        if not image_b64 or not class_id or not student_id:
            return jsonify({"status": "error", "message": "Missing image, classId, or studentId"}), 400

        # Download the known face image from storage
        blob = bucket.blob(f"known_faces/{student_id}.jpg")
        if not blob.exists():
            return jsonify({"status": "error", "message": "No known face image found for this student."}), 404
        blob.download_to_filename(temp_known_path)

        # Decode the base64 image and save it as the captured face
        image_data = base64.b64decode(image_b64.split(",")[1])
        np_arr = np.frombuffer(image_data, np.uint8)
        captured_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if captured_img is None:
            return jsonify({"status": "error", "message": "Captured image could not be decoded."}), 400
        cv2.imwrite(temp_captured_path, captured_img)

        # Use DeepFace to verify the face
        verify_result = DeepFace.verify(
            img1_path=temp_captured_path,
            img2_path=temp_known_path,
            model_name="VGG-Face",
            enforce_detection=False,
        )

        if not verify_result.get("verified", False):
            return jsonify({"status": "fail", "message": "Face not recognized"}), 404

        class_doc = _get_class_document(class_id)
        if not class_doc:
            return jsonify({"status": "error", "message": "Class not found."}), 404

        now = datetime.datetime.now(datetime.timezone.utc)
        is_within_window = _within_class_time_window(class_doc, scan_time=now)

        if is_within_window:
            record = _create_attendance_record(
                student_id=student_id,
                class_id=class_id,
                scan_status="present",
                is_pending=False,
                pending_status=None,
                rejection_reason=None,
            )
            return jsonify({
                "status": "success",
                "message": "Face recognized and attendance marked present.",
                "record": record,
            }), 200
        else:
            record = _create_attendance_record(
                student_id=student_id,
                class_id=class_id,
                scan_status="pending",
                is_pending=True,
                pending_status="absent",
                rejection_reason="Scan outside class time window",
            )
            return jsonify({
                "status": "pending",
                "message": "Scan outside of class time window. Attendance pending review.",
                "record": record,
            }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        for path in (temp_captured_path, temp_known_path):
            try:
                if os.path.exists(path):
                    os.remove(path)
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
