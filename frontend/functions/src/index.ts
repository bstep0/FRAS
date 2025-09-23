import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { db, fieldValue } from "./firebase";
import { processClassReminders } from "./lib/class-reminders";
import { processAttendanceRisk } from "./lib/attendance-risk";
import {
  processAttendanceDecisionTask,
  scheduleDecisionNotification,
} from "./lib/attendance-decision";
import { CENTRAL_TIMEZONE, normalizeStatus } from "./lib/time";
import type {
  AttendanceDecisionTaskData,
  AttendanceRecord,
} from "./lib/types";

const NOTIFICATION_SURFACES = ["banner", "toast", "inbox"] as const;

type NotificationSurface = (typeof NOTIFICATION_SURFACES)[number];

const toAttendanceRecord = (
  snapshot: FirebaseFirestore.DocumentSnapshot
): AttendanceRecord => ({
  id: snapshot.id,
  ...(snapshot.data() as Record<string, unknown>),
});

const isNotificationOwner = (
  auth: CallableRequest["auth"],
  data: FirebaseFirestore.DocumentData
): boolean => {
  if (!auth) {
    return false;
  }
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const loweredEmail = auth.token?.email ? auth.token.email.toLowerCase() : null;
  return (
    (auth.uid && targets.includes(auth.uid)) ||
    (loweredEmail !== null && targets.includes(loweredEmail))
  );
};

export const scheduleClassStartReminders = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: CENTRAL_TIMEZONE,
  },
  async () => {
    await processClassReminders();
  }
);

export const attendanceWriteHandler = onDocumentWritten(
  "attendance/{recordId}",
  async (event) => {
    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;

    if (afterSnapshot?.exists) {
      const afterRecord = toAttendanceRecord(afterSnapshot);
      const beforeRecord = beforeSnapshot?.exists
        ? toAttendanceRecord(beforeSnapshot)
        : null;

      await processAttendanceRisk({
        before: beforeRecord,
        after: afterRecord,
      });

      if (!beforeSnapshot?.exists) {
        const status = normalizeStatus(afterRecord.status);
        if (status === "pending") {
          await scheduleDecisionNotification(afterSnapshot.ref.path);
        }
      }
    }
  }
);

export const attendanceDecisionQueue = onTaskDispatched<AttendanceDecisionTaskData>(
  async (request) => {
    await processAttendanceDecisionTask(request.data);
  }
);

export const acknowledgeNotification = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { notificationId } = request.data || {};
  if (typeof notificationId !== "string" || !notificationId) {
    throw new HttpsError("invalid-argument", "A notificationId string is required.");
  }

  const notificationRef = db.collection("notifications").doc(notificationId);
  const snapshot = await notificationRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Notification does not exist.");
  }

  if (!isNotificationOwner(auth, snapshot.data()!)) {
    throw new HttpsError("permission-denied", "You cannot modify this notification.");
  }

  await notificationRef.update({
    read: true,
    acknowledgedAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
  });

  logger.info("Notification acknowledged", {
    uid: auth.uid,
    notificationId,
  });

  return { acknowledged: true };
});

export const dismissNotificationSurface = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { notificationId, surface, markRead } = request.data || {};

  if (typeof notificationId !== "string" || !notificationId) {
    throw new HttpsError("invalid-argument", "A notificationId string is required.");
  }

  if (typeof surface !== "string" || !NOTIFICATION_SURFACES.includes(surface as NotificationSurface)) {
    throw new HttpsError("invalid-argument", "Surface must be banner, toast, or inbox.");
  }

  const notificationRef = db.collection("notifications").doc(notificationId);
  const snapshot = await notificationRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Notification does not exist.");
  }

  if (!isNotificationOwner(auth, snapshot.data()!)) {
    throw new HttpsError("permission-denied", "You cannot modify this notification.");
  }

  const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    updatedAt: fieldValue.serverTimestamp(),
    [`dismissedSurfaces.${surface}`]: fieldValue.serverTimestamp(),
  };

  if (markRead) {
    updates.read = true;
  }

  await notificationRef.update(updates);

  logger.info("Dismissed notification surface", {
    uid: auth.uid,
    notificationId,
    surface,
  });

  return { dismissed: true };
});

