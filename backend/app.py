from flask import Flask, request, jsonify
import base64
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore, storage
import datetime
import os
from deepface import DeepFace
from zoneinfo import ZoneInfo  

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

@app.route("/api/face-recognition", methods=["POST", "OPTIONS"])
def face_recognition():
    if request.method == "OPTIONS":
        return "", 200

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
        attendance_doc = db.collection("attendance").document(doc_id).get()
        if attendance_doc.exists:
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
        # Create attendance record document in Firebase
        attendance_record = {
            "studentID": student_id,
            "classID": class_id,
            "date": now_central,
            "status": status,
        }
        db.collection("attendance").document(doc_id).set(attendance_record)
        # Data from successful scan
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
        # Clean up temporary files that were created
        if os.path.exists(temp_captured_path):
            os.remove(temp_captured_path)
        if os.path.exists(temp_known_path):
            os.remove(temp_known_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
