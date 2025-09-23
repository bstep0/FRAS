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

from ipaddress import ip_address

try:
    from .allowed_networks import UNT_EAGLENET_NETWORKS
except ImportError:  # pragma: no cover - fallback for script execution
    from allowed_networks import UNT_EAGLENET_NETWORKS

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "https://csce-4095---it-capstone-i.web.app"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# Define the path for credentials
secret_path = '/etc/secrets/firebase_credentials.json'
if os.path.exists(secret_path):
    cred = credentials.Certificate(secret_path)
else:
    cred = credentials.Certificate("backend/firebase/firebase_credentials.json")

# Initialize Firebase app with storage configuration
firebase_admin.initialize_app(cred, {
    "storageBucket": "csce-4095---it-capstone-i.firebasestorage.app"
})
db = firestore.client()
bucket = storage.bucket()  # Initialize storage bucket 

# Timezone for Central Time
CENTRAL_TZ = ZoneInfo("America/Chicago")


def _to_central_iso(timestamp_like):
    """Return an ISO 8601 string in Central time for datetime inputs."""

    if isinstance(timestamp_like, datetime.datetime):
        timestamp = timestamp_like
    elif isinstance(timestamp_like, datetime.date):
        timestamp = datetime.datetime.combine(timestamp_like, datetime.time.min)
    else:
        return ""

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    return timestamp.astimezone(CENTRAL_TZ).isoformat()


def _to_central_date(timestamp_like):
    """Return a YYYY-MM-DD string rendered in Central time."""

    if isinstance(timestamp_like, datetime.datetime):
        target = timestamp_like
    elif isinstance(timestamp_like, datetime.date):
        target = datetime.datetime.combine(timestamp_like, datetime.time.min)
    else:
        return ""

    if target.tzinfo is None:
        target = target.replace(tzinfo=datetime.timezone.utc)

    return target.astimezone(CENTRAL_TZ).strftime("%Y-%m-%d")


def _load_eaglenet_allowlist():
    """Load the EagleNet IP allowlist from the environment."""

    raw_allowlist = os.environ.get("EAGLENET_IP_ALLOWLIST", "")
    networks = []
    for entry in raw_allowlist.split(","):
        candidate = entry.strip()
        if not candidate:
            continue
        try:
            networks.append(ipaddress.ip_network(candidate, strict=False))
        except ValueError:
            continue

    if not networks:
        # Default to only allowing localhost when no configuration is supplied.
        networks.append(ipaddress.ip_network("127.0.0.1/32"))

    return networks


EAGLENET_ALLOWLIST = _load_eaglenet_allowlist()


def extract_request_ip(flask_request):
    """Return the originating IP from X-Forwarded-For or remote_addr."""

    forwarded_for = flask_request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        candidate = forwarded_for.split(",")[0].strip()
        if candidate:
            return candidate
    return flask_request.remote_addr or ""


def is_ip_allowlisted(ip_address):
    try:
        parsed_ip = ipaddress.ip_address(ip_address)
    except ValueError:
        return False

    return any(parsed_ip in network for network in EAGLENET_ALLOWLIST)


def is_request_from_eaglenet(flask_request):
    ip_address = extract_request_ip(flask_request)
    return bool(ip_address and is_ip_allowlisted(ip_address))

def parse_time_12h(timestr):
    
    # Parse a 12-hour formatted time string into a datetime.time object.
    timestr = timestr.strip().upper()
    return datetime.datetime.strptime(timestr, "%I:%M%p").time()

def parse_schedule(schedule_str):
    """
    Expects a schedule string like "MWF 8:30AM - 9:50AM"
    The days like MWF are ignored
    Returns start_time and  end_time as datetime.time objects
    """
    parts = schedule_str.strip().split()
    if parts and not any(char.isdigit() for char in parts[0]):
        time_range_str = " ".join(parts[1:])
    else:
        time_range_str = " ".join(parts)
    if "-" not in time_range_str:
        return None, None
    start_str, end_str = time_range_str.split("-", 1)
    start_time = parse_time_12h(start_str)
    end_time = parse_time_12h(end_str)
    return start_time, end_time

def get_attendance_status(now_dt, start_dt, end_dt):
    # Students can start scanning their attendance 5 minutes before class starts
    allowed_start = start_dt - datetime.timedelta(minutes=5)
    # Up to 15 minutes after class start is considered present
    present_cutoff = start_dt + datetime.timedelta(minutes=15)
    
    if now_dt < allowed_start:
        return None, "Attendance cannot be recorded before the allowed time." # If attempted before allowed time
    if now_dt > end_dt:
        return None, "Attendance cannot be recorded after the allowed time." # If attempted after class end time
    if now_dt <= present_cutoff:
        return "Present", None
    else:
        return "Late", None


def _resolve_record_id(payload):
    record_id = payload.get("recordId")
    if record_id:
        return record_id

    class_id = payload.get("classId")
    student_id = payload.get("studentId")
    date_str = payload.get("date")

    if class_id and student_id and date_str:
        return f"{class_id}_{student_id}_{date_str}"

    return None


def _extract_bearer_token(header_value):
    if not header_value:
        return None

    parts = header_value.split()
    if len(parts) != 2:
        return None

    scheme, token = parts
    if scheme.lower() != "bearer":
        return None

    return token


def _load_teacher_profile(decoded_token):
    """Return the teacher's Firestore document ID and profile dict."""

    teacher_uid = decoded_token.get("uid")
    teacher_email = decoded_token.get("email")

    users_collection = db.collection("users")

    if teacher_uid:
        try:
            doc_ref = users_collection.document(teacher_uid)
            snapshot = doc_ref.get()
        except Exception:
            snapshot = None
        else:
            if snapshot and getattr(snapshot, "exists", False):
                profile = snapshot.to_dict() or {}
                doc_id = getattr(snapshot, "id", None) or getattr(doc_ref, "id", None) or teacher_uid
                return doc_id, profile

    if teacher_email:
        try:
            query = users_collection.where("email", "==", teacher_email).limit(1)
            snapshot = next(query.stream(), None)
        except Exception:
            snapshot = None
        else:
            if snapshot is not None:
                profile = snapshot.to_dict() or {}
                doc_id = getattr(snapshot, "id", None) or teacher_uid or teacher_email
                return doc_id, profile

    return None, {}


def _lookup_student_names(student_ids):
    """Return a mapping of student ID to display name."""

    users_collection = db.collection("users")
    resolved = {}

    for student_id in student_ids:
        display_name = ""

        try:
            candidate_doc = users_collection.document(student_id).get()
        except Exception:
            candidate_doc = None

        if candidate_doc and candidate_doc.exists:
            candidate_data = candidate_doc.to_dict() or {}
        else:
            candidate_data = None
            try:
                query = users_collection.where("id", "==", student_id).limit(1)
                candidate_doc = next(query.stream(), None)
                if candidate_doc is not None:
                    candidate_data = candidate_doc.to_dict() or {}
            except Exception:
                candidate_doc = None
                candidate_data = None

        if candidate_data:
            first = str(candidate_data.get("fname", "")).strip()
            last = str(candidate_data.get("lname", "")).strip()
            display_name = " ".join(part for part in (first, last) if part)
            if not display_name:
                display_name = str(candidate_data.get("displayName", "")) or str(candidate_data.get("name", ""))

        if not display_name:
            display_name = student_id

        resolved[student_id] = display_name

    return resolved


@app.route("/api/attendance/export", methods=["GET"])
def export_attendance():
    class_id = (request.args.get("classId") or "").strip()
    start_date_raw = (request.args.get("startDate") or "").strip()
    end_date_raw = (request.args.get("endDate") or "").strip()

    if not class_id or not start_date_raw or not end_date_raw:
        return jsonify({
            "status": "error",
            "message": "classId, startDate, and endDate are required query parameters.",
        }), 400

    try:
        start_date = datetime.datetime.strptime(start_date_raw, "%Y-%m-%d").date()
        end_date = datetime.datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({
            "status": "error",
            "message": "Dates must be in YYYY-MM-DD format.",
        }), 400

    if start_date > end_date:
        return jsonify({
            "status": "error",
            "message": "startDate must be on or before endDate.",
        }), 400

    bearer_token = _extract_bearer_token(request.headers.get("Authorization"))
    if not bearer_token:
        return jsonify({
            "status": "error",
            "message": "Missing or invalid Authorization header.",
        }), 401

    try:
        decoded_token = firebase_auth.verify_id_token(bearer_token)
    except (firebase_auth.InvalidIdTokenError, firebase_auth.ExpiredIdTokenError, firebase_auth.RevokedIdTokenError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Authentication token is invalid or expired.",
        }), 401
    except Exception:
        return jsonify({
            "status": "error",
            "message": "Unable to verify authentication token.",
        }), 401

    teacher_doc_id, teacher_profile = _load_teacher_profile(decoded_token)
    if not teacher_doc_id:
        return jsonify({
            "status": "error",
            "message": "Unable to locate teacher profile for the authenticated user.",
        }), 403

    teacher_role = str(teacher_profile.get("role", "")).lower()
    if teacher_role != "teacher":
        return jsonify({
            "status": "error",
            "message": "You do not have permission to export attendance records.",
        }), 403

    teacher_identifiers = {teacher_doc_id}
    alternate_identifier = teacher_profile.get("id")
    if alternate_identifier:
        teacher_identifiers.add(str(alternate_identifier))

    class_doc = db.collection("classes").document(class_id).get()
    if not class_doc.exists:
        return jsonify({
            "status": "error",
            "message": "Class not found.",
        }), 404

    class_data = class_doc.to_dict() or {}

    assigned_teachers = set()
    for key in ("teacher", "teacherId", "teacherID", "teachers"):
        value = class_data.get(key)
        if isinstance(value, str):
            assigned_teachers.add(value)
        elif isinstance(value, list):
            assigned_teachers.update(str(item) for item in value if item)

    if assigned_teachers and not (teacher_identifiers & assigned_teachers):
        return jsonify({
            "status": "error",
            "message": "You are not assigned to this class.",
        }), 403

    if not assigned_teachers:
        return jsonify({
            "status": "error",
            "message": "This class does not have an assigned teacher.",
        }), 403

    start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=CENTRAL_TZ)
    end_dt = datetime.datetime.combine(end_date, datetime.time.max, tzinfo=CENTRAL_TZ)

    try:
        attendance_query = (
            db.collection("attendance")
            .where("classID", "==", class_id)
            .where("date", ">=", start_dt)
            .where("date", "<=", end_dt)
        )
        attendance_docs = list(attendance_query.stream())
    except Exception as exc:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch attendance records: {exc}",
        }), 500

    attendance_records = []
    student_ids = set()
    for doc_snapshot in attendance_docs:
        data = doc_snapshot.to_dict() or {}
        attendance_records.append(data)
        student_id = data.get("studentID") or data.get("studentId")
        if student_id:
            student_ids.add(str(student_id))

    student_names = _lookup_student_names(student_ids) if student_ids else {}

    def sort_key(record):
        value = record.get("date")
        if isinstance(value, datetime.datetime):
            return value
        if isinstance(value, datetime.date):
            return datetime.datetime.combine(value, datetime.time.min)
        if isinstance(value, str):
            try:
                return datetime.datetime.fromisoformat(value)
            except ValueError:
                return datetime.datetime.min
        return datetime.datetime.min

    attendance_records.sort(key=sort_key)

    csv_header = [
        "studentName",
        "studentId",
        "date",
        "status",
        "checkInAt",
        "decidedAt",
        "decisionMethod",
    ]

    def row_for_record(record):
        student_id = str(record.get("studentID") or record.get("studentId") or "")
        student_name = student_names.get(student_id, student_id)
        date_value = record.get("date")
        check_in_value = record.get("checkInAt") or record.get("createdAt") or date_value
        decided_value = record.get("decidedAt") or record.get("finalizedAt") or record.get("updatedAt")
        decision_method = record.get("decisionMethod") or record.get("decisionSource") or ""

        return [
            student_name,
            student_id,
            _to_central_date(date_value),
            record.get("status", ""),
            _to_central_iso(check_in_value),
            _to_central_iso(decided_value),
            decision_method,
        ]

    def generate():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(csv_header)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for record in attendance_records:
            writer.writerow(row_for_record(record))
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"attendance-{class_id}-{start_date_raw}-to-{end_date_raw}.csv"
    response = Response(stream_with_context(generate()), mimetype="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=\"{filename}\""
    response.headers["Cache-Control"] = "no-store"

    return response


@app.route("/api/attendance/finalize", methods=["POST"])
def finalize_attendance():
    payload = request.get_json(silent=True) or {}
    record_id = _resolve_record_id(payload)

    if not record_id:
        return jsonify({
            "status": "error",
            "message": "Missing attendance record identifier."
        }), 400

    attendance_ref = db.collection("attendance").document(record_id)
    snapshot = attendance_ref.get()

    if not snapshot.exists:
        return jsonify({
            "status": "error",
            "message": "Pending attendance record not found."
        }), 404

    record = snapshot.to_dict() or {}

    record_status = str(record.get("status", "")).lower()

    if record_status != "pending":
        return jsonify({
            "status": "error",
            "message": "Pending attendance record has expired."
        }), 410

    pending_status = record.get("proposedStatus")

    if pending_status is None:
        pending_status = record.get("pendingStatus")

    if pending_status not in {"Present", "Late"}:
        return jsonify({
            "status": "error",
            "message": "Pending attendance record is invalid."
        }), 400

    now_central = datetime.datetime.now(CENTRAL_TZ)

    if not is_request_from_eaglenet(request):
        rejection_reason = "Follow-up request must originate from EagleNet."
        updates = {
            "status": "Rejected",
            "rejectionReason": rejection_reason,
            "finalizedAt": now_central,
        }

        for field in ("proposedStatus", "pendingStatus"):
            if field in record:
                updates[field] = firestore.DELETE_FIELD

        if "isPending" in record:
            updates["isPending"] = firestore.DELETE_FIELD

        attendance_ref.update(updates)

        return jsonify({
            "status": "rejected",
            "message": rejection_reason,
            "recordId": record_id,
        }), 403

    updates = {
        "status": pending_status,
        "finalizedAt": now_central,
    }

    for field in ("proposedStatus", "pendingStatus"):
        if field in record:
            updates[field] = firestore.DELETE_FIELD

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
     
def get_client_ip(req):
    """Extract the best-effort client IP address from the incoming request."""
    forwarded_for = req.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        for part in forwarded_for.split(","):
            ip_candidate = part.strip()
            if ip_candidate:
                return ip_candidate
    real_ip = req.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return req.remote_addr


def is_ip_allowed(ip_str):
    if not ip_str:
        return False
    try:
        client_ip = ip_address(ip_str)
    except ValueError:
        return False
    return any(client_ip in network for network in UNT_EAGLENET_NETWORKS)

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
        # Assumes that known face images are stored under the "known_faces/" folder in our bucket
        blob = bucket.blob(f"known_faces/{student_id}.jpg")
        if not blob.exists():
            return jsonify({"status": "error", "message": "No known face image found for this student."}), 404
        blob.download_to_filename(temp_known_path)

        # Decode the base64 image and save it as the captured face
        image_data = base64.b64decode(image_b64.split(',')[1])
        np_arr = np.frombuffer(image_data, np.uint8)
        captured_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if captured_img is None:
            return jsonify({"status": "error", "message": "Captured image could not be decoded."}), 400
        cv2.imwrite(temp_captured_path, captured_img)

        # Use DeepFace to verify the face. Compare the captured face with the known face downloaded from storage
        """
        print("Running DeepFace.verify...")
        verify_result = DeepFace.verify(
        img1_path=temp_captured_path,
        img2_path=temp_known_path,
        model_name="VGG-Face",
        enforce_detection=False
        )
        print("DeepFace.verify completed.")
        """
        # Verified result for testing purposes
        # Uncomment the above DeepFace.verify code and comment the below lines for real scan
        verify_result = {
        "verified": True,
        "distance": 0.12,
        "max_threshold_to_verify": 0.3
        }

        print("DeepFace verify result:", verify_result)
        if not verify_result.get("verified", False):
            return jsonify({"status": "fail", "message": "Face not recognized"}), 404

        # Get current central time
        now_central = datetime.datetime.now(CENTRAL_TZ)
        today_str = now_central.strftime("%Y-%m-%d")
        doc_id = f"{class_id}_{student_id}_{today_str}"

        # Check if attendance record already exists
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
                return jsonify({
                    "status": "pending",
                    "message": "Attendance scan is awaiting manual verification.",
                    "recognized_student": student_id,
                    "pending": True,
                    "proposed_attendance_status": existing_record.get("proposedStatus"),
                    "recheck_due_at": existing_recheck_due_iso,
                }), 202
            return jsonify({"status": "already_marked", "message": "Attendance already recorded today."}), 200

        # Retrieve class document to fetch the class schedule
        class_doc = db.collection("classes").document(class_id).get()
        if not class_doc.exists:
            return jsonify({"status": "error", "message": "Class not found"}), 404
        class_data = class_doc.to_dict()
        schedule_str = class_data.get("schedule", "").strip()
        if not schedule_str:
            return jsonify({"status": "error", "message": "No schedule defined for this class"}), 400

        start_time, end_time = parse_schedule(schedule_str)
        if not start_time or not end_time:
            return jsonify({"status": "error", "message": "Invalid schedule format"}), 400

        start_dt = datetime.datetime(
            now_central.year, now_central.month, now_central.day,
            start_time.hour, start_time.minute, 0, 0,
            tzinfo=CENTRAL_TZ
        )
        end_dt = datetime.datetime(
            now_central.year, now_central.month, now_central.day,
            end_time.hour, end_time.minute, 0, 0,
            tzinfo=CENTRAL_TZ
        )

        status, error_msg = get_attendance_status(now_central, start_dt, end_dt)
        if error_msg:
            return jsonify({"status": "fail", "message": error_msg}), 400

        print("Computed attendance status:", status)

        network_evidence = {
            "remoteAddr": request.remote_addr,
            "xForwardedFor": request.headers.get("X-Forwarded-For"),
            "xRealIp": request.headers.get("X-Real-IP"),
            "userAgent": request.headers.get("User-Agent"),
            "forwardedProto": request.headers.get("X-Forwarded-Proto"),
            "requestId": request.headers.get("X-Request-Id"),
        }

        pending_recheck_at = now_central + datetime.timedelta(minutes=45)

        # Create attendance record document in Firebase marked as pending review
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
                "distance": verify_result.get("distance"),
                "threshold": verify_result.get("max_threshold_to_verify"),
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
        }

        # Inform the frontend that the scan is pending manual follow-up
        return jsonify(response_payload), 202

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        # Clean up temporary files that were created
        if os.path.exists(temp_captured_path):
            os.remove(temp_captured_path)
        if os.path.exists(temp_known_path):
            os.remove(temp_known_path)


@app.route("/api/face-recognition", methods=["POST", "OPTIONS"])
def face_recognition():
    if request.method == "OPTIONS":
        return "", 200

    client_ip = get_client_ip(request)
    if not is_ip_allowed(client_ip):
        app.logger.warning("Rejected face recognition request from unauthorized IP %s", client_ip)
        return jsonify({
            "status": "forbidden",
            "message": "Access denied: client IP is not authorized to use this service."
        }), 403

    return _process_face_recognition_request()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
