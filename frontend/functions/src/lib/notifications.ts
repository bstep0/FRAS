import { getFunctions } from "firebase-admin/functions";
import { fieldValue, db } from "../firebase";
import type { Firestore } from "../firebase";
import type {
  NotificationCreation,
  NotificationSurface,
} from "./types";

const sanitize = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, innerValue]) => [key, sanitize(innerValue)])
      .filter(([, innerValue]) => innerValue !== undefined);
    return Object.fromEntries(entries);
  }
  return value;
};

const resolveTargets = (userId: string, userEmail?: string | null): string[] => {
  const targets = new Set<string>();
  if (userId) {
    targets.add(userId);
  }
  if (userEmail) {
    targets.add(userEmail.toLowerCase());
  }
  return Array.from(targets);
};

export interface NotificationWriterOptions {
  db?: Firestore;
}

export const createNotifications = async (
  creation: NotificationCreation,
  options: NotificationWriterOptions = {}
): Promise<void> => {
  const database = options.db ?? db;
  const notificationsRef = database.collection("notifications");
  const surfaces = Array.from(new Set<NotificationSurface>(creation.surfaces));

  await Promise.all(
    surfaces.map(async (surface) => {
      const dedupeKey = `${creation.dedupeKey}:${surface}:${creation.userId}`;
      const existing = await notificationsRef
        .where("dedupeKey", "==", dedupeKey)
        .limit(1)
        .get();

      if (!existing.empty) {
        return;
      }

      const docData = sanitize({
        userId: creation.userId,
        userEmail: creation.userEmail ?? null,
        type: creation.type,
        title: creation.title,
        message: creation.message,
        tone: creation.tone ?? "info",
        actionLabel: creation.actionLabel,
        actionHref: creation.actionHref,
        payload: creation.payload ?? {},
        channel: surface,
        surfaceTargets: surfaces,
        targets: resolveTargets(creation.userId, creation.userEmail ?? undefined),
        read: false,
        dismissedSurfaces: {},
        createdAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
        dedupeKey,
      }) as Record<string, unknown>;

      if (surface === "toast") {
        docData.toast = sanitize({
          autoDismiss: true,
          duration: 8000,
          ...creation.toast,
        });
      }

      if (surface === "banner") {
        docData.banner = sanitize({
          persistent: false,
          ...creation.banner,
        });
      }

      await notificationsRef.add(docData);
    })
  );
};

export const getTaskQueue = (queueName: string) =>
  getFunctions().taskQueue(queueName);

