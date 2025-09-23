import React from "react";
import { Link } from "react-router-dom";
import { toneForNotification, titleForNotification, messageForNotification, actionForNotification } from "../../context/NotificationsContext";

const toneStyles = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  error: "bg-red-50 border-red-200 text-red-900",
};

const buttonToneStyles = {
  info: "bg-blue-600 text-white hover:bg-blue-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  warning: "bg-yellow-500 text-white hover:bg-yellow-600",
  error: "bg-red-600 text-white hover:bg-red-700",
};

const subtleButtonStyles = "text-sm font-medium text-gray-600 hover:text-gray-800";

const NotificationBanner = ({ notification, onDismiss, onAction }) => {
  if (!notification) return null;

  const tone = toneForNotification(notification);
  const title = titleForNotification(notification);
  const message = messageForNotification(notification);
  const action = actionForNotification(notification);
  const toneClass = toneStyles[tone] || toneStyles.info;
  const actionStyles = buttonToneStyles[tone] || buttonToneStyles.info;

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(notification.id);
    }
  };

  const handleAction = (event) => {
    if (onAction) {
      onAction(notification, event);
    }
  };

  const renderAction = () => {
    if (!action) return null;
    const { label, href } = action;
    if (!href) return null;

    if (href.startsWith("/")) {
      return (
        <Link
          to={href}
          onClick={handleAction}
          className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm ${actionStyles}`}
        >
          {label}
        </Link>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleAction}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm ${actionStyles}`}
      >
        {label}
      </a>
    );
  };

  return (
    <div className={`flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-sm md:flex-row md:items-start md:justify-between ${toneClass}`}>
      <div className="flex-1">
        {title && <p className="font-semibold leading-tight">{title}</p>}
        {message && <p className="mt-1 text-sm leading-relaxed text-current">{message}</p>}
      </div>
      <div className="flex items-center justify-end gap-3">
        {renderAction()}
        <button
          type="button"
          onClick={handleDismiss}
          className={subtleButtonStyles}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default NotificationBanner;
