import { DateTime } from "luxon";
import { Timestamp } from "firebase-admin/firestore";

import { db } from "../firebase";
import type { Firestore } from "../firebase";
import { createNotifications } from "./notifications";
import { CENTRAL_TIMEZONE, formatDisplayDate, normalizeStatus } from "./time";
import type {
  AttendanceRecord,
  ClassInfo,
  NotificationCreation,
  StudentInfo,
  UserInfo,
} from "./types";

export interface AttendanceNotificationEvent {
  before?: AttendanceRecord | null;
  after?: AttendanceRecord | null;
}

export interface AttendanceNotificationOverrides {
  db?: Firestore;
  writer?: (creation: NotificationCreation) => Promise<void>;
  fetchStudent?: (database: Firestore, studentId: string) => Promise<StudentInfo | null>;
  fetchClass?: (database: Firestore, classId: string) => Promise<ClassInfo | null>;
  fetchTeacher?: (database: Firestore, teacherId: string) => Promise<UserInfo | null>;
  fetchAbsenceCount?: (
    database: Firestore,
    classId: string,
    studentId: string
  ) => Promise<number>;
  fetchDailySummary?: (
    database: Firestore,
    classId: string,
    date: DateTime
  ) => Promise<Record<string, number>>;
}

const resolveRecordDate = (record: AttendanceRecord): DateTime => {
  const now = DateTime.now().setZone(CENTRAL_TIMEZONE);
  const rawDate = record.date;
  if (!rawDate) {
    return now;
  }

  if (rawDate instanceof Date) {
    return DateTime.fromJSDate(rawDate).setZone(CENTRAL_TIMEZONE);
  }

  if (typeof rawDate.toDate === "function") {
    return DateTime.fromJSDate(rawDate.toDate()).setZone(CENTRAL_TIMEZONE);
  }

  return now;
};

const capitalize = (value: string | null): string => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const processAttendanceNotifications = async (
  event: AttendanceNotificationEvent,
  overrides: AttendanceNotificationOverrides = {}
): Promise<void> => {
  const after = event.after;
  if (!after) return;

  const database = overrides.db ?? db;
  const writer =
    overrides.writer ?? ((creation: NotificationCreation) => createNotifications(creation, { db: database }));

  const status = normalizeStatus(after.status) ?? normalizeStatus(after.proposedStatus);
  const wasPending = normalizeStatus(event.before?.status) === "pending" || event.before?.isPending;
  const isPending = normalizeStatus(after?.status) === "pending" || after?.isPending;

  const classId = after.classID;
  const studentId = after.studentID;

  if (!classId || !studentId) {
    return;
  }

  const fetchStudentFn = overrides.fetchStudent ?? defaultFetchStudent;
  const fetchClassFn = overrides.fetchClass ?? defaultFetchClass;
  const fetchTeacherFn = overrides.fetchTeacher ?? defaultFetchTeacher;
  const fetchAbsenceCountFn = overrides.fetchAbsenceCount ?? defaultFetchAbsenceCount;
  const fetchDailySummaryFn = overrides.fetchDailySummary ?? defaultFetchDailySummary;

  const [student, classInfo] = await Promise.all([
    fetchStudentFn(database, studentId),
    fetchClassFn(database, classId),
  ]);

  const className = classInfo?.name ?? classId;
  const recordDate = resolveRecordDate(after);
  const dateLabel = formatDisplayDate(recordDate);
  const dateKey = recordDate.toISODate();

  if (!event.before && isPending) {
    await Promise.all([
      writer({
        userId: studentId,
        userEmail: student?.email ?? null,
        type: "attendance-pending",
        title: `${className} attendance pending`,
        message: "We need a quick manual review. You'll be notified when it's resolved.",
        tone: "info",
        actionLabel: "View status",
        actionHref: `/student/classes/${classId}`,
        payload: {
          classId,
          className,
          attendanceId: after.id,
          status: "pending",
          reviewDueAt: after.pendingRecheckAt ?? null,
        },
        surfaces: ["toast", "inbox"],
        dedupeKey: `pending-scan-${classId}-${studentId}-${dateKey}`,
        toast: { autoDismiss: false, duration: 12000 },
      }),
      issueTeacherPendingAlert({
        writer,
        classInfo,
        classId,
        student,
        studentId,
        dateLabel,
        database,
        teacherFetcher: fetchTeacherFn,
      }),
    ]);
    return;
  }

  if (wasPending && !isPending && status) {
    const resolvedStatus = capitalize(status);
    const isAbsent = status === "absent";
    await writer({
      userId: studentId,
      userEmail: student?.email ?? null,
      type: "attendance-pending-resolved",
      title: "Attendance review completed",
      message: `Your ${className} attendance on ${dateLabel} is now ${resolvedStatus}.`,
      tone: isAbsent ? "warning" : "success",
      actionLabel: "View attendance",
      actionHref: `/student/classes/${classId}`,
      payload: {
        classId,
        className,
        attendanceId: after.id,
        status: resolvedStatus,
      },
      surfaces: isAbsent ? ["banner", "inbox"] : ["toast", "inbox"],
      dedupeKey: `pending-resolved-${after.id}-${status}`,
      toast: isAbsent ? undefined : { autoDismiss: false, duration: 10000 },
      banner: isAbsent ? { persistent: true } : undefined,
    });
  }

  if (!status || status === "pending") {
    return;
  }

  const isAbsent = status === "absent";
  const resolvedStatus = capitalize(status);

  await writer({
    userId: studentId,
    userEmail: student?.email ?? null,
    type: "attendance-result",
    title: `${className} attendance recorded`,
    message: `Your attendance for ${dateLabel} is marked ${resolvedStatus}.`,
    tone: isAbsent ? "warning" : "success",
    actionLabel: "View details",
    actionHref: `/student/classes/${classId}`,
    payload: {
      classId,
      className,
      attendanceId: after.id,
      status: resolvedStatus,
      recordedAt: DateTime.now().setZone(CENTRAL_TIMEZONE).toISO(),
    },
    surfaces: isAbsent ? ["banner", "inbox"] : ["toast", "inbox"],
    dedupeKey: `attendance-result-${after.id}-${status}`,
    toast: isAbsent ? undefined : { autoDismiss: true, duration: 8000 },
    banner: isAbsent ? { persistent: true } : undefined,
  });

  if (isAbsent) {
    const absenceCount = await fetchAbsenceCountFn(database, classId, studentId);
    await writer({
      userId: studentId,
      userEmail: student?.email ?? null,
      type: "attendance-missed-class",
      title: `You missed ${className}`,
      message: `We did not record you in class on ${dateLabel}. This is absence #${absenceCount}.`,
      tone: "warning",
      actionLabel: "Review attendance",
      actionHref: `/student/classes/${classId}`,
      payload: {
        classId,
        className,
        attendanceId: after.id,
        absenceCount,
      },
      surfaces: ["inbox"],
      dedupeKey: `absent-alert-${classId}-${studentId}-${dateKey}`,
    });

    if (absenceCount === 5) {
      await issueTeacherAbsenceAlert({
        writer,
        classInfo,
        classId,
        student,
        studentId,
        absenceCount,
        dateLabel,
        database,
        teacherFetcher: fetchTeacherFn,
      });
    }
  }

  await issueClassSummary({
    writer,
    classId,
    classInfo,
    dateKey,
    dateLabel,
    summaryFetcher: fetchDailySummaryFn,
    database,
    teacherFetcher: fetchTeacherFn,
  });
};

interface TeacherAlertOptions {
  writer: (creation: NotificationCreation) => Promise<void>;
  classInfo: ClassInfo | null;
  classId: string;
  student: StudentInfo | null;
  studentId: string;
  dateLabel: string;
  database: Firestore;
  teacherFetcher: (database: Firestore, teacherId: string) => Promise<UserInfo | null>;
}

const issueTeacherPendingAlert = async ({
  writer,
  classInfo,
  classId,
  student,
  studentId,
  dateLabel,
  database,
  teacherFetcher,
}: TeacherAlertOptions): Promise<void> => {
  const teacherId = classInfo?.teacher;
  if (!teacherId) return;

  const teacher = await teacherFetcher(database, teacherId);
  if (!teacher) return;

  const studentLabel = student?.fname ? `${student.fname} ${student.lname ?? ""}`.trim() : studentId;

  await writer({
    userId: teacherId,
    userEmail: teacher.email ?? null,
    type: "attendance-pending-review",
    title: `Attendance pending review for ${classInfo?.name ?? classId}`,
    message: `${studentLabel} submitted a scan on ${dateLabel} that needs manual review.`,
    tone: "info",
    actionLabel: "Open review queue",
    actionHref: `/teacher/classes/${classId}`,
    payload: {
      classId,
      className: classInfo?.name ?? classId,
      studentId,
      studentName: studentLabel,
    },
    surfaces: ["inbox"],
    dedupeKey: `pending-review-${classId}-${studentId}-${dateLabel}`,
  });
};

interface AbsenceAlertOptions extends TeacherAlertOptions {
  absenceCount: number;
}

const issueTeacherAbsenceAlert = async ({
  writer,
  classInfo,
  classId,
  student,
  studentId,
  absenceCount,
  dateLabel,
  database,
  teacherFetcher,
}: AbsenceAlertOptions): Promise<void> => {
  const teacherId = classInfo?.teacher;
  if (!teacherId) return;

  const teacher = await teacherFetcher(database, teacherId);
  if (!teacher) return;

  const studentLabel = student?.fname ? `${student.fname} ${student.lname ?? ""}`.trim() : studentId;

  await writer({
    userId: teacherId,
    userEmail: teacher.email ?? null,
    type: "attendance-absence-threshold",
    title: `${studentLabel} reached ${absenceCount} absences`,
    message: `${studentLabel} has ${absenceCount} absences in ${classInfo?.name ?? classId} as of ${dateLabel}.`,
    tone: "warning",
    actionLabel: "View attendance",
    actionHref: `/teacher/classes/${classId}`,
    payload: {
      classId,
      className: classInfo?.name ?? classId,
      studentId,
      studentName: studentLabel,
      absenceCount,
    },
    surfaces: ["inbox"],
    dedupeKey: `absence-threshold-${classId}-${studentId}-${absenceCount}`,
  });
};

interface ClassSummaryOptions {
  writer: (creation: NotificationCreation) => Promise<void>;
  classId: string;
  classInfo: ClassInfo | null;
  dateKey: string | null;
  dateLabel: string;
  summaryFetcher: (database: Firestore, classId: string, date: DateTime) => Promise<Record<string, number>>;
  database: Firestore;
  teacherFetcher: (database: Firestore, teacherId: string) => Promise<UserInfo | null>;
}

const issueClassSummary = async ({
  writer,
  classId,
  classInfo,
  dateKey,
  dateLabel,
  summaryFetcher,
  database,
  teacherFetcher,
}: ClassSummaryOptions): Promise<void> => {
  const teacherId = classInfo?.teacher;
  if (!teacherId || !dateKey) return;

  const teacher = await teacherFetcher(database, teacherId);
  if (!teacher) return;

  const counts = await summaryFetcher(database, classId, DateTime.fromISO(dateKey, { zone: CENTRAL_TIMEZONE }));
  const present = counts.present ?? counts.Present ?? 0;
  const absent = counts.absent ?? counts.Absent ?? 0;
  const pending = counts.pending ?? counts.Pending ?? 0;

  await writer({
    userId: teacherId,
    userEmail: teacher.email ?? null,
    type: "attendance-summary",
    title: `${classInfo?.name ?? classId} attendance summary`,
    message: `${dateLabel}: ${present} present, ${absent} absent, ${pending} pending.`,
    tone: "info",
    actionLabel: "Open class",
    actionHref: `/teacher/classes/${classId}`,
    payload: {
      classId,
      className: classInfo?.name ?? classId,
      date: dateKey,
      counts: { present, absent, pending },
    },
    surfaces: ["inbox"],
    dedupeKey: `attendance-summary-${classId}-${dateKey}`,
  });
};

const defaultFetchStudent = async (
  database: Firestore,
  studentId: string
): Promise<StudentInfo | null> => {
  const doc = await database.collection("users").doc(studentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) } as StudentInfo;
};

const defaultFetchTeacher = async (
  database: Firestore,
  teacherId: string
): Promise<UserInfo | null> => {
  const doc = await database.collection("users").doc(teacherId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) } as UserInfo;
};

const defaultFetchClass = async (
  database: Firestore,
  classId: string
): Promise<ClassInfo | null> => {
  const doc = await database.collection("classes").doc(classId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) } as ClassInfo;
};

const defaultFetchAbsenceCount = async (
  database: Firestore,
  classId: string,
  studentId: string
): Promise<number> => {
  const snapshot = await database
    .collection("attendance")
    .where("classID", "==", classId)
    .where("studentID", "==", studentId)
    .where("status", "in", ["Absent", "absent"])
    .get();

  return snapshot.size;
};

const defaultFetchDailySummary = async (
  database: Firestore,
  classId: string,
  date: DateTime
): Promise<Record<string, number>> => {
  const start = Timestamp.fromDate(date.startOf("day").toJSDate());
  const end = Timestamp.fromDate(date.endOf("day").toJSDate());

  const snapshot = await database
    .collection("attendance")
    .where("classID", "==", classId)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .get();

  return snapshot.docs.reduce((acc, doc) => {
    const status = normalizeStatus(doc.data().status) ?? "unknown";
    const key = capitalize(status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

