import { DateTime } from "luxon";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import type { Firestore } from "../firebase";
import { createNotifications, getTaskQueue } from "./notifications";
import { CENTRAL_TIMEZONE, formatDisplayDate, normalizeStatus } from "./time";
import type {
  AttendanceDecisionTaskData,
  AttendanceRecord,
  ClassInfo,
  NotificationCreation,
  StudentInfo,
} from "./types";

export interface AttendanceDecisionOverrides {
  db?: Firestore;
  writer?: (creation: NotificationCreation) => Promise<void>;
  loadRecord?: (database: Firestore, recordPath: string) => Promise<AttendanceRecord | null>;
  fetchStudent?: (database: Firestore, studentId: string) => Promise<StudentInfo | null>;
  fetchClass?: (database: Firestore, classId: string) => Promise<ClassInfo | null>;
  reschedule?: (payload: AttendanceDecisionTaskData, delaySeconds: number) => Promise<void>;
  now?: DateTime;
}

const MAX_PENDING_ATTEMPTS = 3;
const PENDING_RETRY_DELAY_SECONDS = 10 * 60;
const INITIAL_DELAY_SECONDS = 30 * 60;

export const scheduleDecisionNotification = async (
  recordPath: string
): Promise<void> => {
  const queue = getTaskQueue("attendanceDecisionQueue");
  await queue.enqueue(
    {
      recordPath,
      attempt: 0,
    },
    {
      scheduleDelaySeconds: INITIAL_DELAY_SECONDS,
    }
  );
};

export const processAttendanceDecisionTask = async (
  data: AttendanceDecisionTaskData,
  overrides: AttendanceDecisionOverrides = {}
): Promise<void> => {
  if (!data.recordPath) {
    logger.warn("Received task without record path", data);
    return;
  }

  const database = overrides.db ?? db;
  const loadRecordFn = overrides.loadRecord ?? defaultLoadRecord;
  const record = await loadRecordFn(database, data.recordPath);

  if (!record) {
    logger.info("Attendance record already removed", data);
    return;
  }

  const status = normalizeStatus(record.status) ?? normalizeStatus(record.proposedStatus);

  if (!status || status === "pending") {
    const nextAttempt = (data.attempt ?? 0) + 1;
    if (nextAttempt > MAX_PENDING_ATTEMPTS) {
      logger.warn("Stopping retries for unresolved attendance record", {
        recordPath: data.recordPath,
        attempts: nextAttempt,
      });
      return;
    }

    const rescheduleFn = overrides.reschedule ?? defaultRescheduler;
    await rescheduleFn(
      {
        recordPath: data.recordPath,
        attempt: nextAttempt,
      },
      PENDING_RETRY_DELAY_SECONDS
    );
    return;
  }

  const fetchStudentFn = overrides.fetchStudent ?? defaultFetchStudent;
  const fetchClassFn = overrides.fetchClass ?? defaultFetchClass;

  const student = await fetchStudentFn(database, record.studentID ?? "");
  const classInfo = await fetchClassFn(database, record.classID ?? "");

  const classId = record.classID ?? "unknown-class";
  const className = classInfo?.name ?? classId;
  const reviewDate = resolveRecordDate(record, overrides.now);
  const resolvedStatus = status.charAt(0).toUpperCase() + status.slice(1);
  const isAbsent = status === "absent";
  const surfaces: NotificationCreation["surfaces"] = isAbsent
    ? ["banner", "inbox"]
    : ["toast", "inbox"];

  const writer =
    overrides.writer ?? ((creation: NotificationCreation) => createNotifications(creation, { db: database }));

  await writer({
    userId: record.studentID ?? "",
    userEmail: student?.email ?? null,
    type: "attendance-decision",
    title: isAbsent ? "Attendance review result" : "Attendance finalized",
    message: buildDecisionMessage(className, reviewDate, resolvedStatus, isAbsent),
    tone: isAbsent ? "error" : "success",
    actionLabel: "View attendance",
    actionHref: `/student/classes/${classId}`,
    payload: {
      classId,
      className,
      attendanceId: record.id,
      status: resolvedStatus,
      showToast: !isAbsent,
      reviewedAt: DateTime.now().setZone(CENTRAL_TIMEZONE).toISO(),
    },
    surfaces,
    dedupeKey: `attendance-decision-${record.id}-${status}`,
    toast: isAbsent ? undefined : { autoDismiss: false, duration: 10000 },
    banner: isAbsent ? { persistent: true } : undefined,
  });
};

const buildDecisionMessage = (
  className: string,
  reviewDate: DateTime,
  status: string,
  isAbsent: boolean
): string => {
  const formattedDate = formatDisplayDate(reviewDate);
  if (isAbsent) {
    return `The review marked you as absent for ${className} on ${formattedDate}.`;
  }
  return `The review is complete. You're marked ${status} for ${className} on ${formattedDate}.`;
};

const resolveRecordDate = (
  record: AttendanceRecord,
  fallbackNow?: DateTime
): DateTime => {
  const zoneNow = fallbackNow ?? DateTime.now().setZone(CENTRAL_TIMEZONE);
  const rawDate = record.date;
  if (!rawDate) {
    return zoneNow;
  }
  if (rawDate instanceof Date) {
    return DateTime.fromJSDate(rawDate).setZone(CENTRAL_TIMEZONE);
  }
  if (typeof rawDate.toDate === "function") {
    return DateTime.fromJSDate(rawDate.toDate()).setZone(CENTRAL_TIMEZONE);
  }
  return zoneNow;
};

const defaultLoadRecord = async (
  database: Firestore,
  recordPath: string
): Promise<AttendanceRecord | null> => {
  const doc = await database.doc(recordPath).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) };
};

const defaultFetchStudent = async (
  database: Firestore,
  studentId: string
): Promise<StudentInfo | null> => {
  if (!studentId) {
    return null;
  }
  const doc = await database.collection("users").doc(studentId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) };
};

const defaultFetchClass = async (
  database: Firestore,
  classId: string
): Promise<ClassInfo | null> => {
  if (!classId) {
    return null;
  }
  const doc = await database.collection("classes").doc(classId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) };
};

const defaultRescheduler = async (
  payload: AttendanceDecisionTaskData,
  delaySeconds: number
): Promise<void> => {
  const queue = getTaskQueue("attendanceDecisionQueue");
  await queue.enqueue(payload, { scheduleDelaySeconds: delaySeconds });
};

