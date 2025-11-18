import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import ClassAttendanceChart from "./ClassAttendanceChart";
import TeacherLayout from "./TeacherLayout";
import { useNotifications } from "../context/NotificationsContext";
import { auth, db } from "../firebaseConfig";
import { fetchAttendanceDocuments } from "../utils/attendanceQueries";

const formatDateLabel = (date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const coerceToDate = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    const converted = value.toDate();
    if (!Number.isNaN(converted.getTime())) {
      return new Date(converted);
    }
  }

  if (value instanceof Date) {
    const converted = new Date(value);
    if (!Number.isNaN(converted.getTime())) {
      return converted;
    }
    return null;
  }

  if (typeof value === "number") {
    const converted = new Date(value);
    if (!Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (typeof value === "string") {
    const converted = new Date(value);
    if (!Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (value?.seconds) {
    const converted = new Date(value.seconds * 1000);
    if (!Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  return null;
};

const formatRecordDate = (value) => {
  const parsed = coerceToDate(value);
  return parsed ? formatDateLabel(parsed) : "";
};

const resolveStudentName = (studentData, fallbackName, fallbackId) => {
  if (studentData) {
    const { displayName, fullName, name, firstName, lastName, fname, lname, email } = studentData;

    if (displayName) return displayName;
    if (fullName) return fullName;
    if (name) return name;

    const combined = [firstName || fname, lastName || lname]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (combined) return combined;
    if (email) return email;
  }

  if (fallbackName) return fallbackName;
  if (fallbackId) return fallbackId;

  return "Unknown Student";
};

const TeacherStudentAttendance = () => {
  const { className: classId, studentId } = useParams();

  const [classInfo, setClassInfo] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [isRostered, setIsRostered] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [selectedDate, setSelectedDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [newAttendanceDate, setNewAttendanceDate] = useState(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const [newAttendanceStatus, setNewAttendanceStatus] = useState("Present");
  const { pushToast } = useNotifications();

  const loadClass = useCallback(async () => {
    if (!classId) return;

    try {
      const classSnap = await getDoc(doc(db, "classes", classId));
      if (!classSnap.exists()) {
        setClassInfo(null);
        setIsRostered(false);
        return;
      }

      const classData = classSnap.data() || {};
      setClassInfo({ id: classSnap.id, ...classData });

      const roster =
        classData.students ||
        classData.studentIds ||
        classData.enrolledStudents ||
        classData.classList ||
        [];

      const normalizedRoster = roster.map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          return entry.id || entry.studentID || entry.studentId;
        }
        return null;
      });

      const rosteredIds = new Set(normalizedRoster.filter(Boolean));
      setIsRostered(rosteredIds.has(studentId));
    } catch (error) {
      console.error("Failed to load class info", error);
      setClassInfo(null);
      setIsRostered(false);
      pushToast({
        tone: "error",
        title: "Unable to load class",
        message: "We couldn't load the class details right now.",
      });
    }
  }, [classId, studentId, pushToast]);

  const loadStudentProfile = useCallback(async () => {
    if (!studentId) return;

    try {
      const studentSnap = await getDoc(doc(db, "users", studentId));
      if (studentSnap.exists()) {
        setStudentProfile({ id: studentSnap.id, ...studentSnap.data() });
      } else {
        setStudentProfile(null);
      }
    } catch (error) {
      console.error("Failed to load student profile", error);
      setStudentProfile(null);
    }
  }, [studentId]);

  const fetchAttendanceRecords = useCallback(async () => {
    if (!classId || !studentId) {
      setAttendanceRecords([]);
      return;
    }

    setIsLoading(true);

    try {
      const records = await fetchAttendanceDocuments(db, classId, studentId);

      records.sort((a, b) => {
        const aDate = coerceToDate(a.date) || new Date(0);
        const bDate = coerceToDate(b.date) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

      const name = resolveStudentName(studentProfile, null, studentId);

      const enriched = records.map((record) => {
        const dateValue = coerceToDate(record.date);
        return {
          ...record,
          studentName: name,
          dateValue,
          formattedDate: dateValue ? formatDateLabel(dateValue) : "",
        };
      });

      setAttendanceRecords(enriched);
    } catch (error) {
      console.error("Failed to load attendance records", error);
      setAttendanceRecords([]);
      pushToast({
        tone: "error",
        title: "Unable to load attendance",
        message: "We couldn't load the attendance records for this student.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [classId, studentId, studentProfile, pushToast]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  useEffect(() => {
    loadStudentProfile();
  }, [loadStudentProfile]);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [fetchAttendanceRecords]);

  const attendanceSummary = useMemo(() => {
    const summary = { Present: 0, Absent: 0, Pending: 0 };
    attendanceRecords.forEach((record) => {
      const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
      if (!status) return;
      if (status.includes("pending")) {
        summary.Pending += 1;
        return;
      }
      if (status.includes("present")) {
        summary.Present += 1;
      } else {
        summary.Absent += 1;
      }
    });
    return summary;
  }, [attendanceRecords]);

  const statusBadgeClasses = (status) => {
    const normalizedStatus =
      status === "Present"
        ? "Present"
        : typeof status === "string" && status.toLowerCase().includes("pending")
          ? "Pending"
          : "Absent";

    if (normalizedStatus === "Present") {
      return "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (normalizedStatus === "Pending") {
      return "rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    }
    return "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  const displayStatus = (status) => {
    if (!status) return "Unknown";
    const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
    if (!normalized) return "Unknown";
    if (normalized.includes("pending")) return "Pending";
    if (normalized.includes("present")) return "Present";
    return "Absent";
  };

  const openEditModal = (record) => {
    const normalizedStatus =
      record.status === "Present"
        ? "Present"
        : typeof record.status === "string" && record.status.toLowerCase().includes("pending")
          ? "Pending"
          : "Absent";

    const recordDate = record.dateValue || coerceToDate(record.date);
    const selectedDateValue = recordDate ? recordDate.toISOString() : "";

    setSelectedRecord(record);
    setAttendanceStatus(normalizedStatus);
    setSelectedDate(selectedDateValue);
    setEditReason(record.editReason || "");
  };

  const closeEditModal = () => {
    setSelectedRecord(null);
    setAttendanceStatus("Present");
    setSelectedDate("");
    setEditReason("");
  };

  const handleSave = async () => {
    if (!selectedRecord) return;

    const normalizedStatus =
      attendanceStatus === "Present"
        ? "Present"
        : attendanceStatus === "Pending"
          ? "Pending"
          : "Absent";

    if (!auth.currentUser) {
      pushToast({
        tone: "error",
        title: "Update unavailable",
        message: "You must be signed in to update attendance records.",
      });
      return;
    }

    setIsSaving(true);

    const trimmedEditReason = editReason.trim();
    const parsedSelectedDate = selectedDate ? coerceToDate(selectedDate) : null;
    const fallbackDateValue = selectedRecord.dateValue || coerceToDate(selectedRecord.date) || null;
    const finalDateValue = parsedSelectedDate || fallbackDateValue;
    const dateToPersist = finalDateValue ? Timestamp.fromDate(finalDateValue) : null;

    try {
      await updateDoc(doc(db, "attendance", selectedRecord.id), {
        status: normalizedStatus,
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        editReason: trimmedEditReason,
        date: dateToPersist,
      });

      pushToast({
        tone: "success",
        title: "Attendance updated",
        message: `${selectedRecord.studentName || "Student"}'s attendance was updated to ${normalizedStatus}.`,
      });

      closeEditModal();
      await fetchAttendanceRecords();
    } catch (error) {
      console.error("Failed to update attendance record", error);
      pushToast({
        tone: "error",
        title: "Update failed",
        message: "We couldn't save the attendance update. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAttendance = async () => {
    if (!auth.currentUser) {
      pushToast({
        tone: "error",
        title: "Add unavailable",
        message: "You must be signed in to create attendance records.",
      });
      return;
    }

    if (!classId || !studentId) {
      pushToast({
        tone: "error",
        title: "Missing info",
        message: "A class and student must be selected before creating attendance records.",
      });
      return;
    }

    if (!isRostered) {
      pushToast({
        tone: "error",
        title: "Student not enrolled",
        message: "Attendance can only be recorded for students enrolled in this class.",
      });
      return;
    }

    const parsedDate = newAttendanceDate
      ? new Date(`${newAttendanceDate}T12:00:00`)
      : new Date();

    if (Number.isNaN(parsedDate.getTime())) {
      pushToast({
        tone: "error",
        title: "Invalid date",
        message: "Provide a valid attendance date before saving.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const docId = `${classId}_${studentId}_${newAttendanceDate}`;
      const studentName = resolveStudentName(studentProfile, null, studentId);

      await setDoc(
        doc(db, "attendance", docId),
        {
          classID: classId,
          studentID: studentId,
          studentName,
          studentFullName: studentName,
          status: newAttendanceStatus,
          date: Timestamp.fromDate(parsedDate),
          createdBy: auth.currentUser.uid,
          decisionMethod: "manual-entry",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      pushToast({
        tone: "success",
        title: "Attendance added",
        message: "A new attendance record was added for this student.",
      });

      setIsCreateModalOpen(false);
      await fetchAttendanceRecords();
    } catch (error) {
      console.error("Failed to add attendance record", error);
      pushToast({
        tone: "error",
        title: "Add failed",
        message: "We couldn't create the attendance record. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteRecord = async (record) => {
    if (!record?.id) return;

    const confirmed = window.confirm(
      `Delete the attendance record for ${record.studentName || "this student"}?`
    );

    if (!confirmed) return;

    setIsDeletingId(record.id);

    try {
      await deleteDoc(doc(db, "attendance", record.id));

      pushToast({
        tone: "success",
        title: "Attendance removed",
        message: "The attendance record has been deleted.",
      });

      await fetchAttendanceRecords();
    } catch (error) {
      console.error("Failed to delete attendance record", error);
      pushToast({
        tone: "error",
        title: "Delete failed",
        message: "We couldn't delete this attendance record. Please try again.",
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const studentName = resolveStudentName(studentProfile, null, studentId);

  const dateOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 21; i += 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - i);
      options.push({
        value: date.toISOString(),
        label: formatDateLabel(date),
      });
    }

    if (selectedDate) {
      const hasExisting = options.some((option) => option.value === selectedDate);
      if (!hasExisting) {
        options.unshift({
          value: selectedDate,
          label: formatRecordDate(selectedDate) || selectedDate,
        });
      }
    }

    return options;
  }, [selectedDate]);

  return (
    <TeacherLayout title={studentName ? `${studentName}'s Attendance` : "Student Attendance"}>
      <div className="space-y-6 text-gray-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <Link
            to={`/teacher/classes/${classId}`}
            className="text-sm font-medium text-unt-green hover:text-unt-green dark:text-unt-green/90 dark:hover:text-unt-green"
          >
            ← Back to class
          </Link>
        </div>
        <section className="rounded-lg bg-white p-6 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Attendance Overview</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            Attendance breakdown for this student.
          </p>
          <div className="mt-6 flex justify-start">
            <ClassAttendanceChart attendanceSummary={attendanceSummary} />
          </div>
        </section>
        <section className="rounded-lg bg-white p-6 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">Attendance Records</h2>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded bg-unt-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-unt-green/90 focus:outline-none focus:ring-2 focus:ring-unt-green focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              disabled={!isRostered}
            >
              Add Attendance
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
            Review or edit this student's attendance history.
          </p>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Loading attendance records…
            </p>
          ) : attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No attendance records found for this student.
            </p>
          ) : (
            <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
              <ul className="space-y-4">
                {attendanceRecords.map((record) => (
                  <li
                    key={record.id}
                    className="grid grid-cols-[2fr,auto,auto,auto] items-center gap-4 rounded-lg bg-gray-100 p-4 shadow dark:bg-slate-800"
                  >
                    <div>
                      <span className="text-lg font-semibold">
                        {record.studentName}
                      </span>
                      {record.formattedDate ? (
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {record.formattedDate}
                        </p>
                      ) : null}
                    </div>
                    <span className={statusBadgeClasses(record.status)}>
                      {displayStatus(record.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(record)}
                      className="rounded bg-unt-green px-3 py-1 text-white transition hover:bg-unt-green dark:bg-unt-green dark:hover:bg-unt-green/90"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDeleteRecord(record)}
                      disabled={isDeletingId === record.id}
                      className={`rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 ${
                        isDeletingId === record.id
                          ? "cursor-not-allowed opacity-70"
                          : ""
                      }`}
                    >
                      {isDeletingId === record.id ? "Deleting…" : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Add Attendance</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Create a new attendance record for {studentName}.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Attendance Date</label>
                <input
                  type="date"
                  value={newAttendanceDate}
                  onChange={(event) => setNewAttendanceDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Status</label>
                <select
                  value={newAttendanceStatus}
                  onChange={(event) => setNewAttendanceStatus(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAttendance}
                disabled={isSaving || !isRostered}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  isSaving
                    ? "cursor-not-allowed bg-unt-green dark:bg-unt-green"
                    : "bg-unt-green hover:border-unt-green dark:bg-unt-green dark:hover:bg-unt-green/90"
                }`}
              >
                {isSaving ? "Saving…" : "Add attendance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Edit Attendance</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Student: <strong>{selectedRecord.studentName}</strong>
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Select Date</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                {dateOptions.map((dateOption) => (
                  <option key={dateOption.value} value={dateOption.value}>
                    {dateOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Attendance Status</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Reason For Edit (Optional)
              </label>
              <textarea
                className="w-full resize-y rounded border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                rows={3}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                maxLength={50}
                aria-describedby="edit-reason-help"
              />
              <div id="edit-reason-help" className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {editReason.length}/50 characters
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  isSaving
                    ? "cursor-not-allowed bg-unt-green dark:bg-unt-green"
                    : "bg-unt-green hover:border-unt-green dark:bg-unt-green dark:hover:bg-unt-green/90"
                }`}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
};

export default TeacherStudentAttendance;
