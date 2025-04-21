import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FaceScanner = ({ selectedClass, studentId }) => {
  const videoRef = useRef(null); // Allows live preview of camera feed
  const [scanning, setScanning] = useState(false); // Disable button while scanning
  const navigate = useNavigate();

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true }) // Access the camera
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch((error) => {
        console.error("Error accessing camera:", error);
      });
  };

  useEffect(() => {
    startVideo();
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    // Create a canvas to capture the image from the video element
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg");

    try {
      setScanning(true);

      // Send the captured image to the server for recognition
      const response = await fetch("https://facialrecognitionattendancesystem.onrender.com/api/face-recognition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: dataURL, classId: selectedClass, studentId: studentId }),
      });

      const result = await response.json();
      console.log("Recognition result:", result);
      
      // Status response handling
      if (result.status === "success") {
        alert(`✅ Attendance recorded! Status: ${result.attendance_status}`);
        navigate(`/student/classes/${selectedClass}`, { replace: true });
      } else if (result.status === "already_marked") {
        alert("⚠️ Attendance already recorded today.");
        // Redirects to class view of class that attendance was recorded for
        navigate(`/student/classes/${selectedClass}`);
      } else {
        alert(`❌ ${result.message}`);
      }

    } catch (error) {
      console.error("Error during recognition:", error);
      alert("❌ Error during face recognition.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "300px", height: "300px", background: "#000" }}
      ></video>
      {/* Button to capture the photo and send it to the server */}
      <button onClick={capturePhoto} disabled={scanning} className="bg-green-600 text-white px-3 py-1 rounded mt-4"> 
        {scanning ? "Scanning..." : "Capture Face"}
      </button>
    </div>
  );
};

export default FaceScanner;
