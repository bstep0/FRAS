import React, { useRef, useState } from "react";

const FaceScanner = ({ selectedClass }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedSrc, setCapturedSrc] = useState(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, width, height);

    const dataURL = canvasRef.current.toDataURL("image/png");
    setCapturedSrc(dataURL);

    try {
      const response = await fetch("/api/face-recognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: dataURL,
          classId: selectedClass
        })
      });
      const result = await response.json();
      console.log("Recognition result:", result);
    } catch (error) {
      console.error("Error sending image:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="bg-white p-4 mb-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">Scan Your Face</h2>
      <p className="text-gray-600 mb-2">Class: {selectedClass}</p>
      
      <video
        ref={videoRef}
        className="w-64 h-48 bg-black mb-2"
        autoPlay
        muted
      />

      <div className="flex space-x-2 mb-2">
        <button
          onClick={startCamera}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Start
        </button>
        <button
          onClick={capturePhoto}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          Capture
        </button>
        <button
          onClick={stopCamera}
          className="bg-red-600 text-white px-3 py-1 rounded"
        >
          Stop
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {capturedSrc && (
        <div>
          <h3 className="font-semibold mt-2">Captured Photo:</h3>
          <img src={capturedSrc} alt="Captured face" className="border mt-2" />
        </div>
      )}
    </div>
  );
};

export default FaceScanner;
