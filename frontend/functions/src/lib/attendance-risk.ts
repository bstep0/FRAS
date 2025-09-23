import { db } from "../firebase";
import type { Firestore } from "../firebase";
import { createNotifications } from "./notifications";
import { normalizeStatus } from "./time";
import type {
  AttendanceRecord,
  ClassInfo,
  NotificationCreation,
  StudentInfo,
} from "./types";

export interface AttendanceRiskEvent {
  before?: AttendanceRecord | null;
  after?: AttendanceRecord | null;
}

export interface AttendanceRiskOverrides {
  db?: Firestore;
  writer?: (creation: NotificationCreation) => Promise<void>;
  fetchAbsenceCount?: (
    database: Firestore,
    classId: string,
    studentId: string
  ) => Promise<number>;
  fetchStudent?: (database: Firestore, studentId: string) => Promise<StudentInfo | null>;
  fetchClass?: (database: Firestore, classId: string) => Promise<ClassInfo | null>;
  threshold?: number;
  absenceCount?: number;
  student?: StudentInfo | null;
  classInfo?: ClassInfo | null;
}

const DEFAULT_ABSENCE_THRESHOLD = 5;

export const processAttendanceRisk = async (
  event: AttendanceRiskEvent,
  overrides: AttendanceRiskOverrides = {}
): Promise<void> => {
  const after = event.after;
  if (!after) {
    return;
  }

  const newStatus = normalizeStatus(after.status);
  if (newStatus !== "absent") {
    return;
  }

  const previousStatus = normalizeStatus(event.before?.status);
  if (previousStatus === "absent") {
    return;
  }

  if (after.isPending) {
    return;
  }

  const classId = after.classID;
  const studentId = after.studentID;

  if (!classId || !studentId) {
    return;
  }

  const database = overrides.db ?? db;
  const threshold = overrides.threshold ?? DEFAULT_ABSENCE_THRESHOLD;
  const fetchAbsenceCountFn = overrides.fetchAbsenceCount ?? defaultFetchAbsenceCount;
  const absenceCount =
    overrides.absenceCount ?? (await fetchAbsenceCountFn(database, classId, studentId));

  if (absenceCount <= threshold) {
    return;
  }

  if (absenceCount !== threshold + 1) {
    return;
  }

  const fetchStudentFn = overrides.fetchStudent ?? defaultFetchStudent;
  const fetchClassFn = overrides.fetchClass ?? defaultFetchClass;

  const student = overrides.student ?? (await fetchStudentFn(database, studentId));
  const classInfo = overrides.classInfo ?? (await fetchClassFn(database, classId));
  const className = classInfo?.name ?? classId;

  const writer =
    overrides.writer ?? ((creation: NotificationCreation) => createNotifications(creation, { db: database }));

  await writer({
    userId: studentId,
    userEmail: student?.email ?? null,
    type: "attendance-risk",
    title: "Attendance warning",
    message: `You have ${absenceCount} absences in ${className}. Missing more classes may impact your grade.`,
    tone: "warning",
    actionLabel: "Review attendance",
    actionHref: `/student/classes/${classId}`,
    payload: {
      classId,
      className,
      absenceCount,
      threshold: threshold + 1,
    },
    surfaces: ["banner", "inbox"],
    dedupeKey: `attendance-risk-${classId}-${studentId}-${threshold + 1}`,
    banner: { persistent: true },
  });
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
    .where("status", "==", "Absent")
    .get();

  return snapshot.size;
};

const defaultFetchStudent = async (
  database: Firestore,
  studentId: string
): Promise<StudentInfo | null> => {
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
  const doc = await database.collection("classes").doc(classId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...(doc.data() as Record<string, unknown>) };
};

