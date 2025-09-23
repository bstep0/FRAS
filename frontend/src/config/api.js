const FALLBACK_API_BASE = "https://facialrecognitionattendancesystem.onrender.com";

const rawBase =
  (process.env.REACT_APP_API_BASE || process.env.VITE_API_BASE || FALLBACK_API_BASE).trim();

const trimmedBase = rawBase.replace(/\/$/, "");
const faceRecognitionSuffix = "/api/face-recognition";

let apiBase = trimmedBase;
if (trimmedBase.endsWith(faceRecognitionSuffix)) {
  apiBase = trimmedBase.slice(0, -faceRecognitionSuffix.length);
}

export const API_BASE = apiBase;
export const FACE_RECOGNITION_ENDPOINT = `${API_BASE}/api/face-recognition`;
export const FINALIZE_ATTENDANCE_ENDPOINT = `${API_BASE}/api/attendance/finalize`;
export const PENDING_VERIFICATION_MINUTES = 45;

export default {
  API_BASE,
  FACE_RECOGNITION_ENDPOINT,
  FINALIZE_ATTENDANCE_ENDPOINT,
  PENDING_VERIFICATION_MINUTES,
};
