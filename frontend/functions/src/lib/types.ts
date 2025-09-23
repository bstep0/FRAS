import type { Timestamp } from "firebase-admin/firestore";

export interface ClassInfo {
  id: string;
  name?: string;
  schedule?: string;
  room?: string;
  reminderLeadMinutes?: number;
}

export interface StudentInfo {
  id: string;
  email?: string;
  fname?: string;
  lname?: string;
}

export interface AttendanceRecord {
  id: string;
  classID?: string;
  studentID?: string;
  status?: string;
  isPending?: boolean;
  proposedStatus?: string;
  date?: Date | Timestamp;
}

export interface AttendanceDecisionTaskData {
  recordPath: string;
  attempt?: number;
}

export type NotificationSurface = "banner" | "toast" | "inbox";

export interface NotificationToastOptions {
  autoDismiss?: boolean;
  duration?: number;
}

export interface NotificationBannerOptions {
  persistent?: boolean;
}

export interface NotificationCreation {
  userId: string;
  userEmail?: string | null;
  type: string;
  title: string;
  message: string;
  tone?: string;
  actionLabel?: string;
  actionHref?: string;
  payload?: Record<string, unknown>;
  surfaces: NotificationSurface[];
  dedupeKey: string;
  toast?: NotificationToastOptions;
  banner?: NotificationBannerOptions;
}

