from flask import Flask, request, jsonify
import base64
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os
from deepface import DeepFace
from flask_cors import CORS
from zoneinfo import ZoneInfo  

app = Flask(__name__)
CORS(app)  

secret_path = '/etc/secrets/firebase_credentials.json'

if os.path.exists(secret_path):
    # Load Firebase credentials from the secret file
    cred = credentials.Certificate(secret_path)
else:
    cred = credentials.Certificate("backend/firebase/firebase_credentials.json")

# Initialize the Firebase app with the credentials.
firebase_admin.initialize_app(cred)
db = firestore.client()

# Timezone for Central Time
CENTRAL_TZ = ZoneInfo("America/Chicago")

def parse_time_12h(timestr):
    """
    Parse a 12-hour formatted time string (e.g., "12:30PM") into a datetime.time object.
    """
    timestr = timestr.strip().upper()
    return datetime.datetime.strptime(timestr, "%I:%M%p").time()

def parse_schedule(schedule_str):
    """
    Expects a schedule string like "MWF 8:30AM - 9:50AM" (or "8:30AM - 9:50AM").
    The day tokens (like "MWF") are ignored.
    Returns (start_time, end_time) as datetime.time objects or (None, None) if invalid.
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
    
    # Allowed to start scanning 5 minutes before class starts
    allowed_start = start_dt - datetime.timedelta(minutes=5)
    # Up to 15 minutes after class start is "Present"
    present_cutoff = start_dt + datetime.timedelta(minutes=15)

    # 1) If scanning too early
    if now_dt < allowed_start:
        return None, "Attendance cannot be recorded before the allowed time."

    # 2) If scanning after class end time
    if now_dt > end_dt:
        return None, "Attendance cannot be recorded after the allowed time."

    # 3) Otherwise we are within [allowed_start, end_dt]
    if now_dt <= present_cutoff:
        return "Present", None
    else:
        return "Late", None
    
    # For testing purposes to show "Present" can be recorded, uncomment the line below:
    # return "Present", None

@app.route("/api/face-recognition", methods=["POST", "OPTIONS"])
def face_recognition():
    if request.method == "OPTIONS":
        return "", 200

    # Create temp file
    temp_image_path = "temp_face.jpg"

    try:
        data = request.get_json()
        image_b64 = data.get("image")
        class_id = data.get("classId")
        student_id = data.get("studentId")

        if not image_b64 or not class_id or not student_id:
            return jsonify({"status": "error", "message": "Missing image, classId, or studentId"}), 400

        # Path for the student's known face image
        known_face_path = f"models/known_faces/{student_id}.jpg"
        if not os.path.exists(known_face_path):
            return jsonify({"status": "error", "message": "No known face image found for this student."}), 404

        # Decode the incoming Base64 image and save it to a temporary file
        image_data = base64.b64decode(image_b64.split(',')[1])
        np_arr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        cv2.imwrite(temp_image_path, img)

        # Compare the scanned image with the student's known image
        verify_result = DeepFace.verify(
            img1_path=temp_image_path,
            img2_path=known_face_path,
            model_name="Facenet512",
            enforce_detection=False
        )
        print("DeepFace verify result:", verify_result)
        if not verify_result.get("verified", False):
            return jsonify({"status": "fail", "message": "Face not recognized"}), 404

        # Get the current time in Central Time
        now_central = datetime.datetime.now(CENTRAL_TZ)
        today_str = now_central.strftime("%Y-%m-%d")
        doc_id = f"{class_id}_{student_id}_{today_str}"

        # Check if an attendance record already exists
        attendance_doc = db.collection("attendance").document(doc_id).get()
        if attendance_doc.exists:
            return jsonify({"status": "already_marked", "message": "Attendance already recorded today."}), 200

        # Retrieve the class document to get the schedule
        class_doc = db.collection("classes").document(class_id).get()
        if not class_doc.exists:
            return jsonify({"status": "error", "message": "Class not found"}), 404

        class_data = class_doc.to_dict()
        schedule_str = class_data.get("schedule", "").strip()
        if not schedule_str:
            return jsonify({"status": "error", "message": "No schedule defined for this class"}), 400

        # Parse the schedule ("MWF 8:30AM - 9:50AM") into start and end times.
        start_time, end_time = parse_schedule(schedule_str)
        if not start_time or not end_time:
            return jsonify({"status": "error", "message": "Invalid schedule format"}), 400

        # Create today's datetime objects for the class start and end times in central time
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

        # Attendance status
        status, error_msg = get_attendance_status(now_central, start_dt, end_dt)
        if error_msg:
            return jsonify({"status": "fail", "message": error_msg}), 400

        print("Computed attendance status:", status)

        # Record the attendance
        attendance_record = {
            "studentID": student_id,
            "classID": class_id,
            "date": now_central,
            "status": status,
        }
        db.collection("attendance").document(doc_id).set(attendance_record)

        return jsonify({
            "status": "success",
            "recognized_student": student_id,
            "attendance_status": status,
            "distance": verify_result.get("distance"),
            "threshold": verify_result.get("max_threshold_to_verify")
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
