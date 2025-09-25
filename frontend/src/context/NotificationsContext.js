import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebaseConfig";

const NotificationsContext = createContext(null);

const channelForNotification = (notification) => {
  if (!notification) return "inbox";
  const channel =
    notification.channel ||
    notification.surface ||
    notification.display ||
    notification.target ||
    notification.delivery ||
    notification.category;

  if (channel) {
    return String(channel).toLowerCase();
  }

  const type = notification.type || notification.variant;
  if (!type) return "inbox";

  const lowered = String(type).toLowerCase();
  if (lowered === "banner" || lowered === "toast") {
    return lowered;
  }

  return "inbox";
};

const toneForNotification = (notification) => {
  if (!notification) return "info";
  const tone =
    notification.tone ||
    notification.severity ||
    notification.intent ||
    notification.status ||
    notification.variant ||
    notification.type;

  if (!tone) return "info";

  const lowered = String(tone).toLowerCase();
  if (["info", "success", "warning", "error", "danger"].includes(lowered)) {
    return lowered === "danger" ? "error" : lowered;
  }

  return "info";
};

const titleForNotification = (notification) => {
  if (!notification) return "";
  return (
    notification.title ||
    notification.heading ||
    notification.subject ||
    notification.summary ||
    ""
  );
};

const messageForNotification = (notification) => {
  if (!notification) return "";
  return (
    notification.message ||
    notification.body ||
    notification.description ||
    notification.text ||
    ""
  );
};

const actionForNotification = (notification) => {
  if (!notification) return null;

  const action = notification.action || notification.cta;
  if (action && typeof action === "object") {
    return action;
  }

  const label =
    notification.actionLabel || notification.ctaLabel || notification.buttonLabel;
  const href =
    notification.actionHref ||
    notification.ctaHref ||
    notification.href ||
    notification.link ||
    notification.url;

  if (!label || !href) {
    return null;
  }

  return { label, href };
};

const resolveTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }
  return null;
};

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [userDocId, setUserDocId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [dismissedBannerIds, setDismissedBannerIds] = useState([]);
  const [dismissedToastIds, setDismissedToastIds] = useState([]);
  const [toastQueue, setToastQueue] = useState([]);

  const aggregatedSnapshotsRef = useRef(new Map());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const resolveUserDoc = async () => {
      if (!currentUser?.email) {
        setUserDocId(null);
        setUserRole(null);
        return;
      }
      try {
        const usersRef = collection(db, "users");
        const emailQuery = query(usersRef, where("email", "==", currentUser.email));
        const userSnapshot = await getDocs(emailQuery);
        if (!isCancelled) {
          if (userSnapshot.empty) {
            setUserDocId(null);
            setUserRole(null);
          } else {
            const docSnapshot = userSnapshot.docs[0];
            const profileData = docSnapshot.data() || {};
            const rawRole =
              profileData.role ||
              profileData.type ||
              profileData.accountType ||
              profileData.userType ||
              "";
            const normalizedRole = rawRole ? String(rawRole).toLowerCase() : null;

            setUserDocId(docSnapshot.id);
            setUserRole(normalizedRole);
          }
        }
      } catch (error) {
        console.error("Failed to resolve user document for notifications", error);
        if (!isCancelled) {
          setUserDocId(null);
          setUserRole(null);
        }
      }
    };

    resolveUserDoc();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    aggregatedSnapshotsRef.current = new Map();
  }, [currentUser, userDocId, userRole]);

  const audienceValues = useMemo(() => {
    const values = new Set(["all", "everyone", "public"]);

    if (userRole) {
      values.add(userRole);
      values.add(`${userRole}s`);
    }

    const email = currentUser?.email || "";
    if (email.includes("@my.unt.edu")) {
      values.add("student");
      values.add("students");
    }
    if (email.includes("@unt.edu")) {
      values.add("teacher");
      values.add("teachers");
      values.add("faculty");
    }

    return Array.from(values).filter(Boolean);
  }, [currentUser, userRole]);

  useEffect(() => {
    const notificationsRef = collection(db, "notifications");
    const unsubscribers = [];
    const aggregated = aggregatedSnapshotsRef.current;

    const handleSnapshot = (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        if (change.type === "removed") {
          aggregated.delete(docId);
          return;
        }
        aggregated.set(docId, { id: docId, ...change.doc.data() });
      });

      const sorted = Array.from(aggregated.values()).sort((a, b) => {
        const aDate = resolveTimestamp(a.createdAt) || 0;
        const bDate = resolveTimestamp(b.createdAt) || 0;
        return (bDate instanceof Date ? bDate.getTime() : bDate) -
          (aDate instanceof Date ? aDate.getTime() : aDate);
      });

      setNotifications(sorted);
      setLoading(false);
    };

    const handleError = (error) => {
      console.error("Error loading notifications", error);
      setLoading(false);
    };

    let hasSubscription = false;

    const subscribeToConstraints = (...constraints) => {
      try {
        if (!constraints.length) return;
        const builtQuery = query(notificationsRef, ...constraints);
        unsubscribers.push(onSnapshot(builtQuery, handleSnapshot, handleError));
        hasSubscription = true;
      } catch (error) {
        console.error("Failed to subscribe to notifications", error);
      }
    };

    const generalAudiences = audienceValues.slice(0, 10);
    if (generalAudiences.length) {
      subscribeToConstraints(where("audience", "in", generalAudiences));
      subscribeToConstraints(where("audiences", "array-contains-any", generalAudiences));
    }

    if (currentUser) {
      const idCandidates = Array.from(
        new Set([
          userDocId,
          currentUser?.uid || null,
        ].filter(Boolean))
      );

      if (idCandidates.length > 0) {
        subscribeToConstraints(
          where("userId", "in", idCandidates.slice(0, 10))
        );
      }

      if (currentUser.email) {
        subscribeToConstraints(where("userEmail", "==", currentUser.email));
      }
    }

    if (!hasSubscription) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [currentUser, userDocId, audienceValues]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) return;
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      try {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, { read: true });
      } catch (error) {
        console.error("Failed to mark notification as read", error);
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((notification) => !notification.read);
    if (!unread.length) return;

    setNotifications((prev) => prev.map((notification) => ({
      ...notification,
      read: true,
    })));

    try {
      const batch = writeBatch(db);
      unread.forEach((notification) => {
        batch.update(doc(db, "notifications", notification.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  }, [notifications]);

  const createTestNotification = useCallback(
    async ({ audience = "all", tone = "info" } = {}) => {
      const timestampLabel = new Date().toLocaleString();
      const normalizedAudiences = Array.isArray(audience)
        ? audience.filter(Boolean)
        : [audience, "all"].filter(Boolean);

      const notificationPayload = {
        title: "Test notification",
        message: `This is a sample alert generated at ${timestampLabel}.`,
        tone,
        createdAt: serverTimestamp(),
        read: false,
        audience: normalizedAudiences[0] || "all",
        audiences: Array.from(new Set(normalizedAudiences)),
      };

      if (currentUser?.email) {
        notificationPayload.userEmail = currentUser.email;
      }
      if (currentUser?.uid) {
        notificationPayload.userId = currentUser.uid;
      }
      if (userDocId) {
        notificationPayload.userDocId = userDocId;
      }
      if (userRole) {
        notificationPayload.targetRole = userRole;
      }

      const notificationRef = collection(db, "notifications");
      const docRef = await addDoc(notificationRef, notificationPayload);
      return docRef.id;
    },
    [currentUser, userDocId, userRole]
  );

  const bannerNotification = useMemo(() => {
    return notifications.find(
      (notification) =>
        channelForNotification(notification) === "banner" &&
        !notification.read &&
        !dismissedBannerIds.includes(notification.id)
    );
  }, [notifications, dismissedBannerIds]);

  useEffect(() => {
    setToastQueue((previous) => {
      const existingIds = new Set(previous.map((toast) => toast.id));
      const newToasts = notifications
        .filter((notification) => {
          const channel = channelForNotification(notification);
          if (channel !== "toast") return false;
          if (notification.read) return false;
          if (dismissedToastIds.includes(notification.id)) return false;
          return true;
        })
        .filter((notification) => !existingIds.has(notification.id))
        .map((notification) => ({
          id: notification.id,
          title: titleForNotification(notification) || "Notification",
          message: messageForNotification(notification),
          tone: toneForNotification(notification),
          duration: notification.duration,
          notification,
        }));

      if (!newToasts.length) {
        return previous;
      }

      return [...previous, ...newToasts];
    });
  }, [notifications, dismissedToastIds]);

  const pushToast = useCallback(({ id, title, message, tone, duration }) => {
    const toastId = id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToastQueue((prev) => [
      ...prev,
      {
        id: toastId,
        title: title || "",
        message,
        tone: tone || "info",
        duration,
        notification: null,
      },
    ]);
  }, []);

  const toastNotification = toastQueue.length ? toastQueue[0] : null;

  const dismissBanner = useCallback(
    (notificationId) => {
      if (!notificationId) return;
      setDismissedBannerIds((prev) =>
        prev.includes(notificationId) ? prev : [...prev, notificationId]
      );
      markAsRead(notificationId);
    },
    [markAsRead]
  );

  const dismissToast = useCallback(
    (toastId, { markRead: shouldMarkRead = true } = {}) => {
      if (!toastId) return;

      setToastQueue((prev) => prev.filter((toast) => toast.id !== toastId));
      setDismissedToastIds((prev) =>
        prev.includes(toastId) ? prev : [...prev, toastId]
      );

      if (!shouldMarkRead) return;

      const matchingNotification = notifications.find(
        (notification) => notification.id === toastId
      );
      if (matchingNotification) {
        markAsRead(toastId);
      }
    },
    [markAsRead, notifications]
  );

  const unreadCount = useMemo(() => {
    return notifications.reduce((total, notification) => {
      return notification.read ? total : total + 1;
    }, 0);
  }, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      loading,
      unreadCount,
      markAsRead,
      markAllAsRead,
      bannerNotification,
      dismissBanner,
      toastNotification,
      dismissToast,
      pushToast,
      createTestNotification,
    }),
    [
      notifications,
      loading,
      unreadCount,
      markAsRead,
      markAllAsRead,
      bannerNotification,
      dismissBanner,
      toastNotification,
      dismissToast,
      pushToast,
      createTestNotification,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
};

export const notificationUtils = {
  channelForNotification,
  toneForNotification,
  titleForNotification,
  messageForNotification,
  actionForNotification,
  resolveTimestamp,
};

export {
  channelForNotification,
  toneForNotification,
  titleForNotification,
  messageForNotification,
  actionForNotification,
  resolveTimestamp,
};

export default NotificationsContext;
