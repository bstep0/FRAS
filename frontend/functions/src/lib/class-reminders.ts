import { DateTime } from "luxon";
import { logger } from "firebase-functions/v2";
import { db } from "../firebase";
import type { Firestore } from "../firebase";
import { createNotifications } from "./notifications";
import { CENTRAL_TIMEZONE, parseSchedule } from "./time";
import type {
  ClassInfo,
  NotificationCreation,
  StudentInfo,
} from "./types";

const DEFAULT_LOOKAHEAD_MINUTES = 5;

export interface ClassReminderOverrides {
  now?: DateTime;
  db?: Firestore;
  classes?: ClassInfo[];
  studentsByClass?: Record<string, StudentInfo[]>;
  writer?: (creation: NotificationCreation) => Promise<void>;
  fetchClasses?: (database: Firestore) => Promise<ClassInfo[]>;
  fetchStudents?: (database: Firestore, classId: string) => Promise<StudentInfo[]>;
}

export const processClassReminders = async (
  overrides: ClassReminderOverrides = {}
): Promise<void> => {
  const database = overrides.db ?? db;
  const now = overrides.now ?? DateTime.now().setZone(CENTRAL_TIMEZONE);
  const fetchClassesFn = overrides.fetchClasses ?? defaultFetchClasses;
  const fetchStudentsFn = overrides.fetchStudents ?? defaultFetchStudents;
  const writer =
    overrides.writer ?? ((creation: NotificationCreation) => createNotifications(creation, { db: database }));

  const classes = overrides.classes ?? (await fetchClassesFn(database));

  await Promise.all(
    classes.map(async (classInfo) => {
      if (!classInfo?.id || !classInfo.schedule) {
        return;
      }

      const parsed = parseSchedule(classInfo.schedule, {
        zone: CENTRAL_TIMEZONE,
        baseDate: now,
      });

      if (!parsed) {
        logger.warn("Skipping class with un-parseable schedule", {
          classId: classInfo.id,
          schedule: classInfo.schedule,
        });
        return;
      }

      if (parsed.days.length && !parsed.days.includes(now.weekday)) {
        return;
      }

      const classStart = parsed.start.set({ year: now.year, month: now.month, day: now.day });
      const minutesUntilStart = classStart.diff(now, "minutes").minutes;
      const lookahead = classInfo.reminderLeadMinutes ?? DEFAULT_LOOKAHEAD_MINUTES;

      if (minutesUntilStart < 0 || minutesUntilStart > lookahead) {
        return;
      }

      const students =
        overrides.studentsByClass?.[classInfo.id] ?? (await fetchStudentsFn(database, classInfo.id));

      if (!students.length) {
        return;
      }

      const startTimestamp =
        classStart.startOf("minute").toISO() ?? classStart.toISO();
      const roundedMinutes = Math.max(0, Math.round(minutesUntilStart));
      const className = classInfo.name ?? classInfo.id;
      const startTimeText = classStart.toFormat("h:mm a");

      await Promise.all(
        students.map(async (student) => {
          if (!student?.id) {
            return;
          }

          const message =
            roundedMinutes === 0
              ? `${className} is starting now. Head to class!`
              : `${className} begins at ${startTimeText}. That's in ${roundedMinutes} minute${roundedMinutes === 1 ? "" : "s"}.`;

          await writer({
            userId: student.id,
            userEmail: student.email ?? null,
            type: "class-start-reminder",
            title: `${className} starts soon`,
            message,
            tone: "info",
            actionLabel: "Open class",
            actionHref: `/student/classes/${classInfo.id}`,
            payload: {
              classId: classInfo.id,
              className,
              minutesUntilStart: roundedMinutes,
              startTime: startTimestamp,
            },
            surfaces: ["toast", "inbox"],
            dedupeKey: `class-start-${classInfo.id}-${startTimestamp}-${student.id}`,
            toast: { autoDismiss: true, duration: 8000 },
          });
        })
      );
    })
  );
};

const defaultFetchClasses = async (database: Firestore): Promise<ClassInfo[]> => {
  const snapshot = await database.collection("classes").get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));
};

const defaultFetchStudents = async (
  database: Firestore,
  classId: string
): Promise<StudentInfo[]> => {
  const snapshot = await database
    .collection("users")
    .where("role", "==", "student")
    .where("classes", "array-contains", classId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));
};

