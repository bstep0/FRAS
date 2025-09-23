import React from "react";
import { Link, useLocation } from "react-router-dom";
import NotificationsBell from "./notifications/NotificationsBell";
import NotificationBanner from "./notifications/NotificationBanner";
import NotificationToast from "./notifications/NotificationToast";
import { useNotifications } from "../context/NotificationsContext";

const navigationItems = [
  {
    label: "Dashboard",
    icon: "📌",
    to: "/teacher",
    isActive: (pathname) => pathname === "/teacher",
  },
  {
    label: "My Classes",
    icon: "📚",
    to: "/teacher/classes",
    isActive: (pathname) => pathname.startsWith("/teacher/classes"),
  },
  {
    label: "Messages",
    icon: "💬",
    to: "/teacher/messages",
    isActive: (pathname) => pathname.startsWith("/teacher/messages"),
  },
];

const TeacherLayout = ({ title, headerActions, children }) => {
  const location = useLocation();
  const { bannerNotification, dismissBanner, toastNotification, dismissToast } =
    useNotifications();

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-900">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-white p-6 shadow-sm">
        <img src="/logo.png" alt="Face Recognition" className="w-24 self-center" />
        <h2 className="mt-6 text-xl font-semibold">Attendance System</h2>
        <nav className="mt-8 space-y-2">
          {navigationItems.map((item) => {
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-gray-100 ${
                  active ? "bg-gray-200 text-gray-900" : "text-gray-700"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {headerActions}
            <NotificationsBell />
          </div>
        </header>
        <main className="relative flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

export default TeacherLayout;
