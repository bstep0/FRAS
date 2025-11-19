// Backend configuration for AttendU
// ---------------------------------
// Resolve the API base automatically from the current page, environment, or
// vetted fallbacks so users never have to set localStorage overrides.

const LAN_API_BASE = "http://192.168.1.70:5000"; // Flask on your desktop/LAN
const NGROK_API_BASE = "https://uncoyly-crystallitic-fransisca.ngrok-free.dev"; // ngrok tunnel
const HOSTED_FRONTEND_ORIGIN = "https://csce-4095---it-capstone-i.web.app"; // Firebase Hosting

const normalizeBase = (base) => {
  if (!base || typeof base !== "string") return null;
  const trimmed = base.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
};

const resolveApiBase = () => {
  // 1) Explicit env override always wins if set
  const envBase = normalizeBase(process.env.REACT_APP_API_BASE);
  if (envBase) return envBase;

  if (typeof window !== "undefined") {
    const { origin, hostname, port } = window.location;

    // 2) Vite / LAN dev: React app on 5173, Flask on 5000
    if (
      port === "5173" ||
      hostname === "192.168.1.70" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      return normalizeBase(LAN_API_BASE);
    }

    // 3) Deployed frontend on Firebase → talk to ngrok backend
    if (origin === HOSTED_FRONTEND_ORIGIN) {
      return normalizeBase(NGROK_API_BASE);
    }
  }

  // 4) Last-chance fallbacks if something weird happens
  return (
    normalizeBase(LAN_API_BASE) ||
    normalizeBase(NGROK_API_BASE) ||
    normalizeBase(HOSTED_FRONTEND_ORIGIN)
  );
};

const API_BASE = resolveApiBase();

// Endpoints
export const FACE_RECOGNITION_ENDPOINT = `${API_BASE}/api/face-recognition`;
export const FINALIZE_ATTENDANCE_ENDPOINT = `${API_BASE}/api/attendance/finalize`;
export const EXPORT_ATTENDANCE_ENDPOINT = `${API_BASE}/api/attendance/export`;

// How long the frontend treats a scan as "pending" (minutes)
export const PENDING_VERIFICATION_MINUTES = 1;

export default {
  API_BASE,
  FACE_RECOGNITION_ENDPOINT,
  FINALIZE_ATTENDANCE_ENDPOINT,
  EXPORT_ATTENDANCE_ENDPOINT,
  PENDING_VERIFICATION_MINUTES,
};
