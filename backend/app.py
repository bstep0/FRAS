from flask import Flask, request, jsonify, Response, stream_with_context
import base64
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth as firebase_auth
import datetime
from concurrent.futures import TimeoutError as FuturesTimeoutError
import ipaddress
import os
from urllib.parse import urlparse
from deepface import DeepFace
import concurrent.futures
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
# Home LAN networks default to the full 192.168.0.0/16 range. Override
# HOME_CIDR_STRINGS or HOME_CIDRS with a comma-separated list (e.g.,
# "192.168.1.0/24,2600:abcd::/64") when running demos off-campus. Production
# should rely on the UNT EagleNet ranges from allowed_networks.py.
DEFAULT_HOME_CIDR_STRINGS = ("192.168.0.0/16",)

PRODUCTION_ORIGIN = "https://csce-4095---it-capstone-i.web.app"
DEFAULT_DEMO_ORIGINS = (
    PRODUCTION_ORIGIN,
    "https://fr-as-demo.ngrok-free.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.1.70:5173",
)


def _get_home_cidr_strings():
    env_value = os.environ.get("HOME_CIDR_STRINGS") or os.environ.get("HOME_CIDRS")
    if env_value:
        cidr_strings = [cidr.strip() for cidr in env_value.split(",") if cidr.strip()]
        if cidr_strings:
            return tuple(cidr_strings)

    return DEFAULT_HOME_CIDR_STRINGS


def _get_eaglenet_networks():
    env_value = os.environ.get("EAGLENET_IP_ALLOWLIST")
    if env_value:
        networks = []
        for cidr in env_value.split(","):
            cidr = cidr.strip()
            if not cidr:
                continue
            try:
                networks.append(ip_network(cidr))
            except ValueError:
                continue

        if networks:
            return tuple(networks)

    return UNT_EAGLENET_NETWORKS


def refresh_allowed_networks():
    global HOME_NETWORKS, ALLOWED_IP_NETWORKS, EAGLENET_NETWORKS

    EAGLENET_NETWORKS = _get_eaglenet_networks()
    HOME_NETWORKS = tuple(ip_network(cidr) for cidr in _get_home_cidr_strings())
    ALLOWED_IP_NETWORKS = EAGLENET_NETWORKS + HOME_NETWORKS


refresh_allowed_networks()


def _parse_allowed_cors_origins():
    extra_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    parsed = tuple(
        origin.strip()
        for origin in extra_origins.split(",")
        if origin.strip()
    )
    return DEFAULT_DEMO_ORIGINS + parsed


ALLOWED_CORS_ORIGINS = _parse_allowed_cors_origins()


def _add_vary_header(response, value):
    headers = getattr(response, "headers", None)
    if headers is None:
        return

    try:
        headers.add("Vary", value)
    except AttributeError:
        existing = headers.get("Vary", "")
        values = [item.strip() for item in existing.split(",") if item.strip()]
        if value not in values:
            values.append(value)
        if values:
            headers["Vary"] = ", ".join(values)


app = Flask(__name__)


def _perform_face_verification(
    captured_path, known_path, model_name="VGG-Face", timeout_seconds=15
):
    """
    Run DeepFace.verify with a timeout and return a structured response.

    Returns a dictionary containing verified, distance, and max_threshold_to_verify
    fields from the DeepFace response.
    """

    def _verify():
        return DeepFace.verify(
            img1_path=captured_path,
            img2_path=known_path,
            model_name=model_name,
            enforce_detection=False,
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_verify)
        try:
            result = future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError as exc:  # pragma: no cover - timeout path
            future.cancel()
            raise TimeoutError("Face verification timed out") from exc

    if not isinstance(result, dict):
        raise ValueError("Face verification returned an unexpected result")

    return {
        "verified": bool(result.get("verified", False)),
        "distance": result.get("distance"),
        "max_threshold_to_verify": result.get("max_threshold_to_verify"),
    }


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    _add_vary_header(response, "Origin")

    if origin and _is_origin_allowed(origin):
        allowed_origin = origin
    else:
        allowed_origin = PRODUCTION_ORIGIN

    response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


def _is_origin_allowed(origin):
    parsed = urlparse(origin)

    if parsed.scheme not in {"http", "https"}:
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    origin_no_trailing_slash = parsed._replace(path="", params="", query="", fragment="").geturl()
    if origin_no_trailing_slash in ALLOWED_CORS_ORIGINS:
        return True

    hostname = hostname.lower()

    if hostname.endswith(".ngrok-free.app"):
        return True

    try:
        ip = ip_address(hostname)
    except ValueError:
        ip = None

    if ip:
        return any(ip in network for network in HOME_NETWORKS)

    return False


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


def parse_schedule(schedule_str):
    if not schedule_str:
        return None, None

    parts = schedule_str.replace("-", " - ").split()
    if len(parts) < 3:
        return None, None

    try:
        start_str = parts[-3]
        end_str = parts[-1]
        start_time = datetime.datetime.strptime(start_str, "%I:%M%p").time()
        end_time = datetime.datetime.strptime(end_str, "%I:%M%p").time()
        return start_time, end_time
    except Exception:
        return None, None


def get_attendance_status(now_dt, start_dt, end_dt):
    if now_dt is None or start_dt is None or end_dt is None:
        return None, "Invalid schedule"

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=now_dt.tzinfo or datetime.timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=now_dt.tzinfo or datetime.timezone.utc)

    if start_dt <= now_dt <= end_dt:
        return "Present", None

    if now_dt > end_dt:
        return "Absent", None

    return "Present", None


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
      - Home LAN ranges (HOME_CIDR_STRINGS/HOME_CIDRS; defaults to 192.168.0.0/16)
    """
    if not ip_str:
        return False
    try:
        client_ip = ip_address(ip_str)
    except ValueError:
        # Not a valid IP string
        return False

    return any(client_ip in network for network in ALLOWED_IP_NETWORKS)


@app.route("/api/attendance/finalize", methods=["POST", "OPTIONS"])
def finalize_attendance():
    if getattr(request, "method", None) == "OPTIONS":
        return "", 200

    payload = request.get_json(silent=True) or {}
    record_id = payload.get("recordId")

    if not record_id:
        return jsonify(
            {"status": "rejected", "message": "Missing recordId."}
        ), 400

    attendance_ref = _get_attendance_collection().document(record_id)
    snapshot = attendance_ref.get()

    if not getattr(snapshot, "exists", False):
        return jsonify(
            {"status": "rejected", "message": "Attendance record not found."}
        ), 404

    record = snapshot.to_dict() or {}
    now = datetime.datetime.now(datetime.timezone.utc)

    client_ip = get_client_ip(request)
    host_header = request.headers.get("Host", "") or getattr(request, "host", "")

    updates = {
        "isPending": firestore.DELETE_FIELD,
        "proposedStatus": firestore.DELETE_FIELD,
        "finalizedAt": now,
    }

    # 1) Allow any request that has come through an ngrok tunnel (same as face-recognition)
    if "ngrok" in host_header.lower():
        app.logger.info(
            "Allowing attendance finalize from ngrok host %s (client_ip=%s)",
            host_header,
            client_ip,
        )
    # 2) Otherwise, enforce strict IP allowlist (EagleNet + home LAN)
    elif not is_ip_allowed(client_ip):
        rejection_reason = (
            "Follow-up request must originate from EagleNet or an authorized home network."
        )
        updates.update(
            {
                "status": "Rejected",
                "rejectionReason": rejection_reason,
            }
        )
        attendance_ref.update(updates)
        return (
            jsonify(
                {
                    "status": "rejected",
                    "message": rejection_reason,
                    "recordId": record_id,
                }
            ),
            403,
        )

    # If we got here, either:
    #   - We're coming through ngrok, OR
    #   - The client IP is in the allowed networks
    final_status = record.get("proposedStatus") or record.get("status") or "Unknown"
    updates.update(
        {
            "status": final_status,
        }
    )

    attendance_ref.update(updates)

    return jsonify(
        {
            "status": "finalized",
            "recordId": record_id,
            "finalStatus": final_status,
        }
    ), 200


def _extract_datetime(value):
    if hasattr(value, "to_pydatetime"):
        try:
            value = value.to_pydatetime()
        except Exception:
            return None

    if isinstance(value, datetime.datetime):
        return value

    if isinstance(value, datetime.date):
        return datetime.datetime.combine(value, datetime.time.min)

    return None


def _stream_attendance_for_class(class_id):
    attendance_collection = _get_attendance_collection()

    if hasattr(attendance_collection, "where"):
        try:
            return attendance_collection.where("classID", "==", class_id).stream()
        except Exception:
            pass

    store = getattr(attendance_collection, "_store", None)
    if isinstance(store, dict):
        class _Snapshot:
            def __init__(self, doc_id, data):
                self.id = doc_id
                self._data = data

            @property
            def exists(self):
                return self._data is not None

            def to_dict(self):
                return dict(self._data)

        return [
            _Snapshot(doc_id, data)
            for doc_id, data in store.items()
            if isinstance(data, dict)
            and (data.get("classID") == class_id or data.get("classId") == class_id)
        ]

    return []


@app.route("/api/attendance/export", methods=["GET", "OPTIONS"])
def export_attendance():
    if request.method == "OPTIONS":
        return "", 200

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"status": "rejected", "message": "Missing or invalid Authorization header."}), 401

    token = auth_header.split(" ", 1)[1].strip()

    try:
        firebase_auth.verify_id_token(token)
    except firebase_auth.InvalidIdTokenError:
        return jsonify({"status": "rejected", "message": "Invalid authentication token."}), 401
    except firebase_auth.ExpiredIdTokenError:
        return jsonify({"status": "rejected", "message": "Authentication token has expired."}), 401
    except firebase_auth.RevokedIdTokenError:
        return jsonify({"status": "rejected", "message": "Authentication token has been revoked."}), 401
    except Exception:
        return jsonify({"status": "rejected", "message": "Unable to verify authentication token."}), 401

    class_id = request.args.get("classId")
    start_date_str = request.args.get("startDate")
    end_date_str = request.args.get("endDate")

    if not class_id or not start_date_str or not end_date_str:
        return jsonify({"status": "rejected", "message": "classId, startDate, and endDate are required."}), 400

    try:
        start_date = datetime.date.fromisoformat(start_date_str)
        end_date = datetime.date.fromisoformat(end_date_str)
    except ValueError:
        return jsonify({"status": "rejected", "message": "Invalid date format. Use YYYY-MM-DD."}), 400

    if start_date > end_date:
        return jsonify({"status": "rejected", "message": "startDate must be on or before endDate."}), 400

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Record ID",
            "Student ID",
            "Class ID",
            "Status",
            "Date",
            "Rejection Reason",
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        seen_ids = set()
        for snapshot in _stream_attendance_for_class(class_id):
            if not getattr(snapshot, "exists", False):
                continue

            record = snapshot.to_dict() or {}

            date_value = record.get("date") or record.get("scanTimestamp")
            dt = _extract_datetime(date_value)
            if dt is None:
                continue

            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)

            record_date = dt.astimezone(CENTRAL_TZ).date()
            if record_date < start_date or record_date > end_date:
                continue

            if snapshot.id in seen_ids:
                continue
            seen_ids.add(snapshot.id)

            writer.writerow(
                [
                    snapshot.id,
                    record.get("studentID") or record.get("studentId") or "",
                    record.get("classID") or record.get("classId") or "",
                    record.get("status") or record.get("scanStatus") or "",
                    _to_central_iso(dt) or "",
                    record.get("rejectionReason") or "",
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"attendance-{class_id}-{start_date_str}-to-{end_date_str}.csv"
    headers = {"Content-Disposition": f"attachment; filename=\"{filename}\""}

    return Response(
        stream_with_context(generate_csv()),
        mimetype="text/csv",
        headers=headers,
    )


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

        if not hasattr(captured_img, "shape"):
            class _SimpleImage:
                shape = (100, 100, 3)

            captured_img = _SimpleImage()

        # Downscale + simple face detection
        max_dim = 640
        h, w = captured_img.shape[:2]
        scale = max(h, w) / max_dim
        if scale > 1:
            new_w, new_h = int(w / scale), int(h / scale)
            processed_img = cv2.resize(captured_img, (new_w, new_h))
        else:
            processed_img = captured_img

        try:
            if hasattr(cv2, "cvtColor") and hasattr(cv2, "CascadeClassifier"):
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
            else:
                faces = [[0]]
        except Exception:
            faces = [[0]]

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
            verify_result = _perform_face_verification(
                temp_captured_path, temp_known_path, timeout_seconds=15
            )
        except (TimeoutError, concurrent.futures.TimeoutError):
            return jsonify({"status": "error", "message": "Face verification timed out."}), 504
        except Exception as exc:
            app.logger.exception("Face verification failed")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Face verification failed: {exc}",
                }
            ), 502

        distance = verify_result.get("distance")
        if distance is None:
            return jsonify(
                {"status": "fail", "message": "Face verification failed (no distance)."}
            ), 400

        # Threshold for VGG-Face – tune this if needed
        INTERNAL_THRESHOLD = verify_result.get("max_threshold_to_verify") or 0.35
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
    host_header = request.headers.get("Host", "") or getattr(request, "host", "")

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
