import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import StudentLayout from "../StudentLayout";
import TeacherLayout from "../TeacherLayout";
import {
  useNotifications,
  resolveTimestamp,
  titleForNotification,
  messageForNotification,
  toneForNotification,
  actionForNotification,
} from "../../context/NotificationsContext";

const formatDateTime = (date) => {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const toneBadgeClasses = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100",
  success: "bg-green-100 text-green-700 dark:bg-emerald-500/20 dark:text-emerald-100",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-amber-500/20 dark:text-amber-100",
  error: "bg-red-100 text-red-700 dark:bg-rose-500/20 dark:text-rose-100",
};

const NotificationsPage = ({ title = "Notifications" }) => {
  const location = useLocation();
  const isTeacherView = location.pathname.startsWith("/teacher");
  const LayoutComponent = isTeacherView ? TeacherLayout : StudentLayout;
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    pushToast,
    createTestNotification,
  } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !notification.read);
    }
    if (filter === "read") {
      return notifications.filter((notification) => notification.read);
    }
    return notifications;
  }, [notifications, filter]);

  const handleMarkAsRead = (event, notificationId) => {
    event.preventDefault();
    markAsRead(notificationId);
  };

  const renderActionButton = (notification) => {
    const action = actionForNotification(notification);
    if (!action) return null;

    const { href, label } = action;
    if (!href || !label) return null;

    const classes =
      "inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-200 dark:hover:text-blue-100";

    if (href.startsWith("/")) {
      return (
        <Link to={href} className={classes}>
          {label}
        </Link>
      );
    }

    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  };

  const renderNotificationRow = (notification) => {
    const titleText = titleForNotification(notification) || "Notification";
    const messageText = messageForNotification(notification);
    const createdAt = resolveTimestamp(notification.createdAt);
    const tone = toneForNotification(notification);
    const badgeClass = toneBadgeClasses[tone] || toneBadgeClasses.info;

    return (
      <li
        key={notification.id}
        className={`flex flex-col gap-3 border-b border-gray-100 px-6 py-4 last:border-b-0 transition-colors dark:border-slate-800 ${
          notification.read
            ? "bg-white/90 dark:border-slate-700/60 dark:bg-slate-950/50"
            : "bg-blue-50 dark:bg-slate-900/60"
        }`}
      >
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </span>
              {createdAt ? (
                <span className="text-xs text-gray-500 dark:text-slate-400">{formatDateTime(createdAt)}</span>
              ) : null}
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{titleText}</p>
            {messageText ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{messageText}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            {!notification.read ? (
              <button
                type="button"
                onClick={(event) => handleMarkAsRead(event, notification.id)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-200 dark:hover:text-blue-100"
              >
                Mark as read
              </button>
            ) : null}
            {renderActionButton(notification)}
          </div>
        </div>
      </li>
    );
  };

  return (
    <LayoutComponent title={title}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-unt-green/10 bg-white/90 p-5 shadow-sm transition dark:border-slate-700/60 dark:bg-slate-900/70 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Inbox</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              View your alerts, reminders, and updates here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === "all"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === "unread"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setFilter("read")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === "read"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Read
            </button>
            <button
              type="button"
              onClick={markAllAsRead}
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              disabled={!notifications.some((notification) => !notification.read)}
            >
              Mark all as read
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-unt-green/10 bg-white/90 shadow-sm transition dark:border-slate-700/60 dark:bg-slate-900/70">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300">Loading your notifications…</p>
          ) : filteredNotifications.length ? (
            <ul>{filteredNotifications.map(renderNotificationRow)}</ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-base font-semibold text-slate-900 dark:text-white">No notifications to show</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Stay tuned! Alerts will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </LayoutComponent>
  );
};

export default NotificationsPage;
