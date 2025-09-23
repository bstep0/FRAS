import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StudentLayout from "../StudentLayout";
import { useNotifications, resolveTimestamp, titleForNotification, messageForNotification, toneForNotification, actionForNotification } from "../../context/NotificationsContext";

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
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
};

const NotificationsPage = ({ title = "Notifications" }) => {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState("all");

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

    const classes = "inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800";

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
      <li key={notification.id} className={`flex flex-col gap-3 border-b border-gray-100 px-6 py-4 last:border-b-0 ${
        notification.read ? "bg-white" : "bg-blue-50"
      }`}
      >
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </span>
              {createdAt ? (
                <span className="text-xs text-gray-500">{formatDateTime(createdAt)}</span>
              ) : null}
            </div>
            <p className="mt-2 text-base font-semibold text-gray-900">{titleText}</p>
            {messageText ? (
              <p className="mt-1 text-sm text-gray-700">{messageText}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            {!notification.read ? (
              <button
                type="button"
                onClick={(event) => handleMarkAsRead(event, notification.id)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
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
    <StudentLayout title={title}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Inbox</h2>
            <p className="text-sm text-gray-600">
              Review alerts, reminders, and updates from your instructors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === "unread" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setFilter("read")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === "read" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Read
            </button>
            <button
              type="button"
              onClick={markAllAsRead}
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              disabled={!notifications.some((notification) => !notification.read)}
            >
              Mark all as read
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-gray-500">Loading your notifications…</p>
          ) : filteredNotifications.length ? (
            <ul>{filteredNotifications.map(renderNotificationRow)}</ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-base font-semibold text-gray-900">No notifications to show</p>
              <p className="mt-2 text-sm text-gray-600">
                Stay tuned! Alerts from your instructors and school will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default NotificationsPage;
