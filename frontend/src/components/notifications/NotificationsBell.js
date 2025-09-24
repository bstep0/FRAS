import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useNotifications,
  resolveTimestamp,
  titleForNotification,
  messageForNotification,
  toneForNotification,
} from "../../context/NotificationsContext";

const BellIcon = ({ className = "" }) => (
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
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const formatRelativeTime = (date) => {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "Just now";
  }
  if (diff < hour) {
    const minutes = Math.round(diff / minute);
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(diff / day);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toneIndicator = {
  info: "text-unt-green",
  success: "text-unt-green",
  warning: "text-amber-500",
  error: "text-red-500",
};

const NotificationsBell = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const latestNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleSelect = (notification) => {
    markAsRead(notification.id);
    const actionHref =
      notification.actionHref ||
      notification.ctaHref ||
      notification.href ||
      notification.link ||
      notification.route;

    setOpen(false);

    if (actionHref && typeof actionHref === "string") {
      if (actionHref.startsWith("http")) {
        window.open(actionHref, "_blank", "noopener,noreferrer");
      } else {
        navigate(actionHref);
      }
    }
  };

  const renderNotification = (notification) => {
    const title = titleForNotification(notification) || "Notification";
    const message = messageForNotification(notification);
    const timestamp = resolveTimestamp(notification.createdAt);
    const tone = toneForNotification(notification);
    const indicatorClass = toneIndicator[tone] || toneIndicator.info;

    const baseClasses = notification.read
      ? "bg-white/70 hover:bg-white/90 dark:bg-slate-900/60 dark:hover:bg-slate-900/70"
      : "bg-unt-green/10 hover:bg-unt-green/15 dark:bg-unt-green/20 dark:hover:bg-unt-green/25";

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => handleSelect(notification)}
        className={`flex w-full flex-col items-start gap-2 border-b border-unt-green/10 px-4 py-3 text-left text-sm last:border-b-0 transition-colors ${baseClasses}`}
      >
        <div className="flex w-full items-center justify-between gap-4">
          <p className={`font-semibold ${indicatorClass}`}>{title}</p>
          <span className="text-xs text-slate-500 dark:text-slate-300">{formatRelativeTime(timestamp)}</span>
        </div>
        {message ? <p className="text-sm text-slate-700 dark:text-slate-200">{message}</p> : null}
      </button>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex items-center justify-center rounded-full border border-unt-green/40 bg-white/80 p-2 text-unt-green shadow-sm transition hover:border-unt-green hover:bg-white/90 dark:border-white/15 dark:bg-slate-900/70 dark:text-white"
        aria-label="View notifications"
      >
        <BellIcon className="h-5 w-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-unt-green/15 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-unt-green/10 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Notifications</p>
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-semibold text-unt-green transition hover:text-unt-greenDark disabled:text-gray-300 dark:text-unt-green/80 dark:disabled:text-slate-500"
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">Loading notifications…</p>
            ) : latestNotifications.length ? (
              latestNotifications.map(renderNotification)
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">You're all caught up!</p>
            )}
          </div>
          <div className="border-t border-unt-green/10 bg-unt-green/5 px-4 py-2 text-right dark:border-white/10 dark:bg-white/5">
            <Link
              to="/student/notifications"
              className="text-sm font-semibold text-unt-green transition hover:text-unt-greenDark"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsBell;

