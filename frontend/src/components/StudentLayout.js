import React from "react";
import { Link, useLocation } from "react-router-dom";
import NotificationsBell from "./notifications/NotificationsBell";
import NotificationBanner from "./notifications/NotificationBanner";
import NotificationToast from "./notifications/NotificationToast";
import ThemeToggle from "./ThemeToggle";
import SignOutButton from "./SignOutButton";
import { useNotifications } from "../context/NotificationsContext";
import useUserProfile from "../hooks/useUserProfile";

const iconClass = "h-5 w-5";

const navigationItems = [
  {
    label: "Dashboard",
    icon: (
      <svg
        className={iconClass}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 13h8V3H3z" />
        <path d="M13 21h8v-8h-8z" />
        <path d="M13 3h8v6h-8z" />
        <path d="M3 21h8v-6H3z" />
      </svg>
    ),
    to: "/student",
    isActive: (pathname) => pathname === "/student",
  },
  {
    label: "My Classes",
    icon: (
      <svg
        className={iconClass}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <path d="M13 3v5h5" />
        <path d="M8 13h6" />
        <path d="M8 17h6" />
      </svg>
    ),
    to: "/student/classes",
    isActive: (pathname) => pathname.startsWith("/student/classes"),
  },
  {
    label: "Notifications",
    icon: (
      <svg
        className={iconClass}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    to: "/student/notifications",
    isActive: (pathname) =>
      pathname.startsWith("/student/notifications") || pathname.startsWith("/student/messages"),
  },
];

const StudentLayout = ({ title, headerActions, children }) => {
  const location = useLocation();
  const { bannerNotification, dismissBanner, toastNotification, dismissToast } = useNotifications();
  const { displayName, email } = useUserProfile();

  return (
    <div className="flex min-h-screen bg-transparent text-slate-900 transition-colors duration-300 dark:text-slate-100">
      <aside className="relative flex w-72 flex-shrink-0 flex-col overflow-hidden border-r border-unt-green/10 bg-unt-forest text-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-0 bg-unt-gradient opacity-95" aria-hidden />
        <div className="relative flex h-full flex-col p-8">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-lg font-semibold">Facial Recognition Attendance System</p>
            </div>
          </div>
          <nav className="mt-10 space-y-2">
            {navigationItems.map((item) => {
              const active = item.isActive(location.pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                    active ? "bg-white/20 text-white shadow-lg" : "hover:bg-white/10 text-white/80 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition group-hover:border-white/40 group-hover:bg-white/20 ${
                      active ? "border-white/60 bg-white/25" : ""
                    }`}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-8">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-3">
                <img
                  src="/profile-placeholder.svg"
                  alt={`${displayName || "Student"} profile`}
                  className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-md"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{displayName || "Student"}</p>
                  <p className="truncate text-xs text-white/70">{email || "student@my.unt.edu"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-unt-green/10 bg-white/80 px-6 py-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-unt-green dark:text-unt-green/70">
              Student Portal
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {headerActions}
            <ThemeToggle />
            <SignOutButton />
            <NotificationsBell />
          </div>
        </header>
        <main className="relative flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {bannerNotification ? (
              <NotificationBanner
                notification={bannerNotification}
                onDismiss={dismissBanner}
              />
            ) : null}
            {children}
          </div>
        </main>
      </div>
      {toastNotification ? (
        <NotificationToast toast={toastNotification} onDismiss={dismissToast} />
      ) : null}
    </div>
  );
};

export default StudentLayout;
