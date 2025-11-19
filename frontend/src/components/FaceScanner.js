import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FACE_RECOGNITION_ENDPOINT,
  FINALIZE_ATTENDANCE_ENDPOINT,
  PENDING_VERIFICATION_MINUTES,
} from "../config/api";

console.log("FACE_RECOGNITION_ENDPOINT =", FACE_RECOGNITION_ENDPOINT);

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
  const [hasConsented, setHasConsented] = useState(false);
  const [consentError, setConsentError] = useState(
    "Please agree to the privacy policy to enable scanning."
  );

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

      let result = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Failed to parse finalize response JSON", parseError);
      }

      if (!isMountedRef.current) return;

      if (!response.ok) {
        // Hard failure: 4xx/5xx → show error and restart
        const message =
          (result && result.message) ||
          "Unable to finalize attendance. Please try again from EagleNet.";
        throw new Error(message);
      }

      const status = (result?.status || "").toLowerCase();

      // Treat both "success" and "finalized" (or similar) as success
      if (status === "success" || status === "finalized" || status === "ok") {
        setNotification({
          type: "success",
          message: "Attendance finalized! You're all set.",
        });
        resetPendingState();
        navigationTimeoutRef.current = setTimeout(() => {
          navigate(`/student/classes/${selectedClass}`, { replace: true });
        }, 2000);
        return;
      }

      // If the backend explicitly says "rejected", keep the guidance
      if (status === "rejected") {
        const guidance = "Please stay on EagleNet and try again.";
        const fallbackMessage = `We could not confirm your attendance. ${guidance}`;
        const combinedMessage = result?.message
          ? `${result.message}${
              result.message.trim().endsWith(".") ? "" : "."
            } ${guidance}`
          : fallbackMessage;

        setNotification({
          type: "warning",
          message: combinedMessage.trim(),
        });
        resetPendingState({ restartStream: true });
        return;
      }

      // Any other weird but 200 OK response:
      // assume the backend probably did its job and show a softer message.
      setNotification({
        type: "info",
        message:
          result?.message?.trim() ||
          "Attendance update completed. Please verify your status in the class page.",
      });
      resetPendingState();
      navigationTimeoutRef.current = setTimeout(() => {
        navigate(`/student/classes/${selectedClass}`, { replace: true });
      }, 2000);
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

    if (!hasConsented) {
      setConsentError("Please agree to the privacy policy before starting your scan.");
      return;
    }

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

      const contentType = response.headers?.get?.("content-type") || "";
      let result = null;

      if (
        (contentType.includes("application/json") || !contentType) &&
        typeof response.json === "function"
      ) {
        try {
          result = await response.json();
        } catch (parseError) {
          console.error("Failed to parse face recognition response", parseError);
        }
      }

      if (!isMountedRef.current) return;

      if (!result) {
        setNotification({
          type: "error",
          message:
            "The backend returned an unexpected response (it might be offline or the tunnel may have closed). Please try again once connectivity is restored.",
        });
        return;
      }

      const recordId = result.recordId || result.record_id;

      if (!response.ok) {
        setNotification({
          type: "error",
          message:
            result?.message ||
            "The backend returned an unexpected response (it might be offline or the tunnel may have closed). Please try again once connectivity is restored.",
        });
        return;
      }

      if (result.status === "success") {
        // Currently not used by the backend, but kept for future flexibility
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
      } else if (result.status === "pending" && recordId) {
        beginPendingFlow(recordId);
      } else if (result.status === "pending" && !recordId) {
        // Safety net: pending without recordId should not normally happen
        setNotification({
          type: "error",
          message:
            "Your scan is pending, but we could not start the verification timer. Please try scanning again.",
        });
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

        <div className="mt-4 w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-unt-green focus:ring-unt-green"
              checked={hasConsented}
              onChange={(event) => {
                setHasConsented(event.target.checked);
                if (event.target.checked) {
                  setConsentError("");
                } else {
                  setConsentError(
                    "Please agree to the privacy policy to enable scanning."
                  );
                }
              }}
            />
            <span>
              I agree to the{" "}
              <Link
                to="/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-unt-green underline decoration-2 decoration-unt-green/60 underline-offset-2"
              >
                Privacy Policy
              </Link>{" "}
              and consent to the use of my photo for attendance verification.
            </span>
          </label>
          {consentError ? (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {consentError}
            </p>
          ) : null}
        </div>

        <button
          onClick={capturePhoto}
          disabled={scanning || captureDisabled || !hasConsented}
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
        <div
          className="rounded-xl border border-unt-green/40 bg-unt-green/10 p-4 shadow-sm backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {/* Green clock icon */}
            <div className="mt-1 text-unt-green" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2zm1 10.41 3.3 3.29a1 1 0 1 1-1.42 1.42L11 13V7a1 1 0 0 1 2 0z" />
              </svg>
            </div>

            <div className="flex-1 space-y-2">
              {/* Header + countdown */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-unt-green">
                  Verification Pending
                </p>

                {remainingSeconds !== null && (
                  <span
                    data-testid="pending-countdown"
                    className="inline-flex items-center gap-2 rounded-full border border-unt-green/50 bg-white/50 px-3 py-1 text-xs font-semibold text-unt-green dark:bg-slate-900/40"
                  >
                    <span
                      className="h-2 w-2 rounded-full bg-unt-green animate-ping"
                      aria-hidden="true"
                    />
                    Auto-finalizing in {formatRemainingTime()}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Stay on EagleNet and keep this page open while we verify your attendance.
              </p>

              <p className="text-sm text-slate-700 dark:text-slate-300">
                We'll finalize automatically when the timer ends — please avoid closing this tab or switching networks.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceScanner;
