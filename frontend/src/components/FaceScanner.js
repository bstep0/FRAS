import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FACE_RECOGNITION_ENDPOINT,
  FINALIZE_ATTENDANCE_ENDPOINT,
  PENDING_VERIFICATION_MINUTES,
} from "../config/api";

const FaceScanner = ({ selectedClass, studentId }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const navigationTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [captureDisabled, setCaptureDisabled] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  const clearPendingTimers = useCallback(() => {
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const stopVideo = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.error("Failed to stop media track", error);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startVideo = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setNotification({
        type: "error",
        message: "Camera access is not supported on this device.",
      });
      return;
    }

    stopVideo();

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (!isMountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error("Error accessing camera:", error);
        if (!isMountedRef.current) return;
        setNotification({
          type: "error",
          message:
            "Unable to access the camera. Please check your permissions and try again.",
        });
      });
  }, [stopVideo]);

  const resetPendingState = useCallback(
    ({ restartStream } = { restartStream: false }) => {
      clearPendingTimers();
      setIsPending(false);
      setRemainingSeconds(null);
      setCaptureDisabled(false);

      if (restartStream) {
        startVideo();
      }
    },
    [clearPendingTimers, startVideo]
  );

  useEffect(() => {
    isMountedRef.current = true;
    startVideo();

    return () => {
      isMountedRef.current = false;
      clearPendingTimers();
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      stopVideo();
    };
  }, [startVideo, stopVideo, clearPendingTimers]);

  const finalizeAttendance = useCallback(
    async (recordId) => {
      if (!recordId) return;

      setNotification({
        type: "info",
        message: "Finalizing your attendance. This may take a moment...",
      });

      try {
        const response = await fetch(FINALIZE_ATTENDANCE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId }),
        });

        const result = await response.json();

        if (!isMountedRef.current) return;

        if (!response.ok) {
          throw new Error(result?.message || "Unable to finalize attendance");
        }

        if (result.status === "success") {
          setNotification({
            type: "success",
            message: "Attendance finalized! You're all set.",
          });
          resetPendingState();
          navigationTimeoutRef.current = setTimeout(() => {
            navigate(`/student/classes/${selectedClass}`, { replace: true });
          }, 2000);
        } else {
          const guidance = "Please stay on EagleNet and try again.";
          const fallbackMessage = `We could not confirm your attendance. ${guidance}`;
          const combinedMessage = result.message
            ? `${result.message}${result.message.trim().endsWith(".") ? "" : "."} ${guidance}`
            : fallbackMessage;
          setNotification({
            type: "warning",
            message: combinedMessage.trim(),
          });
          resetPendingState({ restartStream: true });
        }
      } catch (error) {
        console.error("Failed to finalize attendance", error);
        if (!isMountedRef.current) return;
        setNotification({
          type: "error",
          message:
            "We lost connection while finalizing. Make sure you remain on EagleNet and recapture your photo.",
        });
        resetPendingState({ restartStream: true });
      }
    },
    [navigate, resetPendingState, selectedClass]
  );

  const beginPendingFlow = useCallback(
    (recordId) => {
      setIsPending(true);
      setCaptureDisabled(true);
      stopVideo();

      setNotification({
        type: "info",
        message:
          "Verification is pending. Keep this page open and stay connected to EagleNet for 45 minutes.",
      });

      const totalSeconds = PENDING_VERIFICATION_MINUTES * 60;
      setRemainingSeconds(totalSeconds);

      const intervalId = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null) return prev;
          if (prev <= 1) {
            clearInterval(intervalId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      countdownIntervalRef.current = intervalId;

      finalizeTimeoutRef.current = setTimeout(() => {
        finalizeAttendance(recordId);
      }, PENDING_VERIFICATION_MINUTES * 60 * 1000);
    },
    [finalizeAttendance, stopVideo]
  );

  const capturePhoto = async () => {
    if (scanning || captureDisabled || !videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);
    const dataURL = canvas.toDataURL("image/jpeg");

    try {
      setScanning(true);
      setNotification(null);

      const response = await fetch(FACE_RECOGNITION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: dataURL,
          classId: selectedClass,
          studentId,
        }),
      });

      const result = await response.json();

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error(result?.message || "Face recognition failed");
      }

      if (result.status === "success") {
        stopVideo();
        setNotification({
          type: "success",
          message: `Attendance recorded! Status: ${result.attendance_status || "present"}.`,
        });
        navigationTimeoutRef.current = setTimeout(() => {
          navigate(`/student/classes/${selectedClass}`, { replace: true });
        }, 2000);
      } else if (result.status === "already_marked") {
        stopVideo();
        setNotification({
          type: "warning",
          message: "Attendance already recorded today.",
        });
        navigationTimeoutRef.current = setTimeout(() => {
          navigate(`/student/classes/${selectedClass}`, { replace: true });
        }, 2000);
      } else if (result.status === "pending" && result.record_id) {
        beginPendingFlow(result.record_id);
      } else {
        setNotification({
          type: "error",
          message: result.message || "Face recognition did not match. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error during recognition:", error);
      if (!isMountedRef.current) return;
      setNotification({
        type: "error",
        message: "Error during face recognition. Please try again.",
      });
    } finally {
      if (isMountedRef.current) {
        setScanning(false);
      }
    }
  };

  const formatRemainingTime = () => {
    if (remainingSeconds === null) return null;

    const minutes = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const buttonLabel = () => {
    if (scanning) return "Scanning...";
    if (isPending) return "Verification Pending";
    return "Capture Face";
  };

  const notificationStyles = {
    success: "bg-green-100 text-green-800 border border-green-200",
    error: "bg-red-100 text-red-800 border border-red-200",
    warning: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    info: "bg-blue-100 text-blue-800 border border-blue-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        <video
          ref={videoRef}
          data-testid="face-video"
          autoPlay
          playsInline
          className="w-72 h-72 bg-black rounded"
        />
        <button
          onClick={capturePhoto}
          disabled={scanning || captureDisabled}
          className={`bg-green-600 text-white px-3 py-1 rounded mt-4 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {buttonLabel()}
        </button>
      </div>

      {notification && (
        <div
          className={`p-3 rounded ${
            notificationStyles[notification.type] || notificationStyles.info
          }`}
          role="alert"
        >
          {notification.message}
        </div>
      )}

      {isPending && (
        <div className="p-4 rounded bg-yellow-50 border border-yellow-200">
          <p className="font-semibold text-yellow-900">
            Stay on EagleNet and keep this page open for the next 45 minutes.
          </p>
          <p className="text-sm text-yellow-800 mt-2">
            We'll automatically finalize your attendance when the timer ends.
          </p>
          {remainingSeconds !== null && (
            <p className="mt-3 font-mono text-yellow-900" data-testid="pending-countdown">
              Time remaining: {formatRemainingTime()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FaceScanner;
