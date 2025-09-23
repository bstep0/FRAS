import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { toneForNotification, messageForNotification, titleForNotification, actionForNotification } from "../../context/NotificationsContext";

const toneClasses = {
  info: {
    container: "border-blue-200 bg-white",
    indicator: "bg-blue-500",
  },
  success: {
    container: "border-green-200 bg-white",
    indicator: "bg-green-500",
  },
  warning: {
    container: "border-yellow-200 bg-white",
    indicator: "bg-yellow-500",
  },
  error: {
    container: "border-red-200 bg-white",
    indicator: "bg-red-500",
  },
};

const NotificationToast = ({ toast, onDismiss, onAction }) => {
  useEffect(() => {
    if (!toast) return undefined;
    const autoDismiss = toast.notification
      ? toast.notification.autoDismiss ?? toast.notification.autoHide ?? true
      : toast.autoDismiss ?? toast.autoHide ?? true;

    if (!autoDismiss) return undefined;

    const duration = toast.duration || toast.notification?.duration || 5000;

    const timeoutId = setTimeout(() => {
      if (onDismiss) {
        onDismiss(toast.id, { markRead: true });
      }
    }, duration);

    return () => clearTimeout(timeoutId);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const tone = toast.notification
    ? toneForNotification(toast.notification)
    : toast.tone || "info";
  const classes = toneClasses[tone] || toneClasses.info;

  const title = toast.notification
    ? titleForNotification(toast.notification)
    : toast.title;

  const message = toast.notification
    ? messageForNotification(toast.notification)
    : toast.message;

  const action = toast.notification
    ? actionForNotification(toast.notification)
    : toast.action;

  const handleClose = () => {
    if (onDismiss) {
      onDismiss(toast.id, { markRead: true });
    }
  };

  const handleAction = (event) => {
    if (onAction) {
      onAction(toast, event);
    }
  };

  const renderAction = () => {
    if (!action) return null;
    const { label, href } = action;
    if (!label || !href) return null;

    const commonClasses =
      "text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none";

    if (href.startsWith("/")) {
      return (
        <Link to={href} className={commonClasses} onClick={handleAction}>
          {label}
        </Link>
      );
    }

    return (
      <a
        href={href}
        className={commonClasses}
        onClick={handleAction}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-xs sm:max-w-sm">
      <div
        className={`relative overflow-hidden rounded-lg border shadow-lg transition-all ${classes.container}`}
      >
        <div className={`absolute left-0 top-0 h-full w-1 ${classes.indicator}`} aria-hidden />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {title ? (
                <p className="text-sm font-semibold text-gray-900">{title}</p>
              ) : null}
              {message ? (
                <p className="mt-1 text-sm text-gray-700">{message}</p>
              ) : null}
              {renderAction() ? (
                <div className="mt-3">{renderAction()}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="ml-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Dismiss notification"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
