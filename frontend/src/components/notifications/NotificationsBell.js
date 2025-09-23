import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications, resolveTimestamp, titleForNotification, messageForNotification, toneForNotification } from "../../context/NotificationsContext";

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
  info: "text-blue-600",
  success: "text-green-600",
  warning: "text-yellow-600",
  error: "text-red-600",
};

const NotificationsBell = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

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

  const latestNotifications = useMemo(() => {
    return notifications.slice(0, 6);
  }, [notifications]);

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

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => handleSelect(notification)}
        className={`flex w-full flex-col items-start gap-1 border-b px-4 py-3 text-left last:border-b-0 ${
          notification.read ? "bg-white" : "bg-blue-50"
        } hover:bg-blue-100`}
      >
        <div className="flex w-full items-center justify-between">
          <p className={`text-sm font-medium ${indicatorClass}`}>{title}</p>
          <span className="text-xs text-gray-500">{formatRelativeTime(timestamp)}</span>
        </div>
        {message ? (
          <p className="text-sm text-gray-700">{message}</p>
        ) : null}
      </button>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex items-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50"
        aria-label="View notifications"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-300"
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-gray-500">Loading notifications…</p>
            ) : latestNotifications.length ? (
              latestNotifications.map(renderNotification)
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500">You're all caught up!</p>
            )}
          </div>
          <div className="border-t bg-gray-50 px-4 py-2 text-right">
            <Link
              to="/student/notifications"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
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
