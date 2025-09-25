import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { useNotifications } from "../context/NotificationsContext";

const SignOutIcon = ({ className = "" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const SignOutButton = ({ className = "" }) => {
  const navigate = useNavigate();
  const { pushToast } = useNotifications();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut(auth);
      pushToast({
        tone: "success",
        title: "Signed out",
        message: "You have been signed out successfully.",
      });
      navigate("/");
    } catch (error) {
      console.error("Failed to sign out", error);
      pushToast({
        tone: "error",
        title: "Sign out failed",
        message: "We couldn't sign you out. Please try again.",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`group inline-flex items-center gap-2 rounded-full border border-unt-green/40 bg-white/70 px-3 py-1.5 text-sm font-medium text-unt-green shadow-sm transition hover:border-unt-green hover:text-unt-greenDark dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-200 ${className}`}
      disabled={isSigningOut}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-unt-green/10 text-unt-green transition group-hover:bg-unt-green/15 dark:bg-white/10 dark:text-white">
        <SignOutIcon className="h-4 w-4" />
      </span>
      <span className="pr-2">Sign out</span>
      <span className="sr-only">Sign out of the Facial Recognition Attendance System</span>
    </button>
  );
};

export default SignOutButton;
