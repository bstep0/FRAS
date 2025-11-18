// Backend configuration for AttendU
// ---------------------------------
// Default: use your desktop backend on your home network (LAN).
// Override: if localStorage.apiBase is set in the browser, use that instead.
//   - This lets your campus laptop use an ngrok URL WITHOUT redeploying.
//   - Your home machines keep using the LAN IP by default.

// 1) Default backend base URL (home desktop on LAN)
const DEFAULT_API_BASE = "http://192.168.1.70:5000"; // update if your LAN IP changes

// 2) Resolve the active base URL
function resolveApiBase() {
  // In the browser, allow a local override via localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    const stored = window.localStorage.getItem("apiBase");
    if (stored && typeof stored === "string" && stored.trim().length > 0) {
      return stored.replace(/\/$/, ""); // strip trailing slash
    }
  }

  // Fallback: use the LAN backend
  return DEFAULT_API_BASE.replace(/\/$/, "");
}

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
