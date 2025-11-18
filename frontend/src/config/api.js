// Backend configuration for AttendU
// ---------------------------------
// Resolve the API base automatically from the current page, environment, or
// vetted fallbacks so users never have to set localStorage overrides.

// Primary candidates
const LAN_API_BASE = "http://192.168.1.70:5000"; // update if your LAN IP changes
const NGROK_API_BASE = "https://uncoyly-crystallitic-fransisca.ngrok-free.dev"; // ngrok tunnel for off-campus access
const HOSTED_API_BASE = "https://csce-4095---it-capstone-i.web.app"; // deployed frontend domain

const FALLBACK_API_BASES = [
  // 1) Explicit environment override
  process.env.REACT_APP_API_BASE,
  // 2) Same-origin backend (covers localhost and deployed hosting)
  typeof window !== "undefined" ? window.location.origin : null,
  // 3) Known fallbacks
  LAN_API_BASE,
  NGROK_API_BASE,
  HOSTED_API_BASE,
];

const normalizeBase = (base) => {
  if (!base || typeof base !== "string") return null;
  const trimmed = base.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
};

const resolveApiBase = () => {
  const uniqueCandidates = Array.from(
    new Set(FALLBACK_API_BASES.map(normalizeBase).filter(Boolean))
  );

  return uniqueCandidates[0];
};

const API_BASE = resolveApiBase();

// 3) Endpoints
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
