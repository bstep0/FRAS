// TeacherClassView.js
// The teacher's individual class view page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNotifications } from "../context/NotificationsContext";
import ClassAttendanceChart from "./ClassAttendanceChart";
import { EXPORT_ATTENDANCE_ENDPOINT } from "../config/api";
import TeacherLayout from "./TeacherLayout";

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
    const { displayName, fullName, name, firstName, lastName, email } = studentData;

    if (displayName) return displayName;
    if (fullName) return fullName;
    if (name) return name;

    const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (combined) return combined;
    if (email) return email;
  }

  if (fallbackName) return fallbackName;
  if (fallbackId) return fallbackId;

  return "Unknown Student";
};

const TeacherClassView = () => {
  // URL param: /teacher/classes/:className
  const { className: classId } = useParams();

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [selectedDate, setSelectedDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newAttendanceStatus, setNewAttendanceStatus] = useState("Present");
  const [newAttendanceDate, setNewAttendanceDate] = useState(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { pushToast } = useNotifications();

  const fetchAttendanceRecords = useCallback(async () => {
    if (!classId) {
      setAttendanceRecords([]);
      return;
    }

    setIsLoading(true);

    try {
      const attendanceRef = collection(db, "attendance");
      const attendanceQuery = query(attendanceRef, where("classID", "==", classId));
      const attendanceSnapshot = await getDocs(attendanceQuery);

      const rawRecords = attendanceSnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));

      const studentIds = [
        ...new Set(
          rawRecords
            .map((record) => record.studentID)
            .filter((studentId) => Boolean(studentId))
        ),
      ];

      const studentMap = new Map();

      await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const studentRef = doc(db, "users", studentId);
            const studentSnapshot = await getDoc(studentRef);
            if (studentSnapshot.exists()) {
              studentMap.set(studentId, {
                id: studentSnapshot.id,
                ...studentSnapshot.data(),
              });
            } else {
              studentMap.set(studentId, null);
            }
          } catch (error) {
            console.error("Failed to resolve student info", error);
            studentMap.set(studentId, null);
          }
        })
      );

      const enrichedRecords = rawRecords.map((record) => {
        const studentData = studentMap.get(record.studentID);
        const studentName = resolveStudentName(
          studentData,
          record.studentName || record.studentFullName,
          record.studentID
        );

        const dateValue = coerceToDate(record.date);

        return {
          ...record,
          student: studentData,
          studentName,
          dateValue,
          formattedDate: dateValue ? formatDateLabel(dateValue) : "",
        };
      });

      enrichedRecords.sort((a, b) =>
        a.studentName.localeCompare(b.studentName, undefined, {
          sensitivity: "base",
        })
      );

      setAttendanceRecords(enrichedRecords);
    } catch (error) {
      console.error("Failed to load attendance records", error);
      pushToast({
        tone: "error",
        title: "Unable to load attendance",
        message:
          "We couldn't load the attendance records for this class. Please try again.",
      });
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [classId, pushToast]);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [fetchAttendanceRecords]);

  const generateDateOptions = useCallback(() => {
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

  const dateOptions = useMemo(() => generateDateOptions(), [generateDateOptions]);

  const attendanceSummary = useMemo(() => {
    const summary = { Present: 0, Absent: 0, Late: 0 };

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return summary;
    }

    attendanceRecords.forEach((record) => {
      const status =
        typeof record.status === "string" ? record.status.trim().toLowerCase() : "";

      if (!status) return;

      if (status === "present" || status === "present (remote)") {
        summary.Present += 1;
        return;
      }

      if (status === "late" || status === "tardy") {
        summary.Late += 1;
        return;
      }

      if (status === "absent" || status === "excused" || status === "unexcused") {
        summary.Absent += 1;
        return;
      }

      if (status.includes("present")) {
        summary.Present += 1;
      } else if (status.includes("late") || status.includes("tardy")) {
        summary.Late += 1;
      } else {
        summary.Absent += 1;
      }
    });

    return summary;
  }, [attendanceRecords]);

  const openModal = (record) => {
    if (!record) return;

    const normalizedStatus =
      record.status === "Present"
        ? "Present"
        : record.status === "Late" || record.status === "Tardy"
          ? "Late"
          : "Absent";

    const recordDate = record.dateValue || coerceToDate(record.date);
    const selectedDateValue = recordDate ? recordDate.toISOString() : "";

    setSelectedRecord(record);
    setAttendanceStatus(normalizedStatus);
    setSelectedDate(selectedDateValue);
    setEditReason(record.editReason || "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
    setAttendanceStatus("Present");
    setSelectedDate("");
    setEditReason("");
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewStudentName("");
    setNewStudentId("");
    setNewAttendanceStatus("Present");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setNewAttendanceDate(today.toISOString().split("T")[0]);
  };

  const handleSave = async () => {
    if (!selectedRecord) return;

    const normalizedStatus =
      attendanceStatus === "Present"
        ? "Present"
        : attendanceStatus === "Late"
          ? "Late"
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

    const studentName = selectedRecord.studentName || "Student";
    const trimmedEditReason = editReason.trim();

    const parsedSelectedDate = selectedDate ? coerceToDate(selectedDate) : null;
    const fallbackDateValue =
      selectedRecord.dateValue || coerceToDate(selectedRecord.date) || null;
    const finalDateValue = parsedSelectedDate || fallbackDateValue;
    const dateToPersist = finalDateValue ? Timestamp.fromDate(finalDateValue) : null;

    try {
      const attendanceDocRef = doc(db, "attendance", selectedRecord.id);
      await updateDoc(attendanceDocRef, {
        status: normalizedStatus,
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        editReason: trimmedEditReason,
        date: dateToPersist,
      });

      pushToast({
        tone: "success",
        title: "Attendance updated",
        message: `${studentName}'s attendance was updated to ${normalizedStatus}.`,
      });

      closeModal();
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
    const trimmedName = newStudentName.trim();
    const trimmedId = newStudentId.trim();

    if (!trimmedName && !trimmedId) {
      pushToast({
        tone: "error",
        title: "Missing student info",
        message: "Enter a student name or ID to create an attendance record.",
      });
      return;
    }

    if (!auth.currentUser) {
      pushToast({
        tone: "error",
        title: "Add unavailable",
        message: "You must be signed in to create attendance records.",
      });
      return;
    }

    if (!classId) {
      pushToast({
        tone: "error",
        title: "Class unavailable",
        message: "A class must be selected before creating attendance records.",
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

    setIsCreating(true);

    try {
      await addDoc(collection(db, "attendance"), {
        classID: classId,
        studentID: trimmedId || null,
        studentName: trimmedName || trimmedId || "Unknown Student",
        studentFullName: trimmedName || undefined,
        status: newAttendanceStatus,
        date: Timestamp.fromDate(parsedDate),
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      pushToast({
        tone: "success",
        title: "Attendance added",
        message: "A new attendance record was added to this class.",
      });

      closeCreateModal();
      await fetchAttendanceRecords();
    } catch (error) {
      console.error("Failed to add attendance record", error);
      pushToast({
        tone: "error",
        title: "Add failed",
        message: "We couldn't create the attendance record. Please try again.",
      });
    } finally {
      setIsCreating(false);
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

  const statusBadgeClasses = (status) => {
    const normalizedStatus =
      status === "Present"
        ? "Present"
        : status === "Absent"
          ? "Absent"
          : status === "Late" || status === "Tardy"
            ? "Late"
            : "Other";

    if (normalizedStatus === "Present") {
      return "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
    if (normalizedStatus === "Absent") {
      return "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (normalizedStatus === "Late") {
      return "rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    }
    return "rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200";
  };

  const handleExportAttendance = async () => {
    setExportFeedback(null);

    if (!startDate || !endDate) {
      setExportFeedback({
        type: "error",
        message: "Select a start and end date before exporting attendance.",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setExportFeedback({
        type: "error",
        message: "The start date must be on or before the end date.",
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setExportFeedback({
        type: "error",
        message: "You must be signed in as a teacher to export attendance records.",
      });
      return;
    }

    setIsExporting(true);

    try {
      const idToken = await user.getIdToken();
      const url = new URL(EXPORT_ATTENDANCE_ENDPOINT);
      url.searchParams.set("classId", classId);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        let errorMessage = "Unable to export attendance. Please try again later.";
        try {
          const data = await response.json();
          if (data?.message) errorMessage = data.message;
        } catch {
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch { /* ignore */ }
        }
        setExportFeedback({ type: "error", message: errorMessage });
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      let filename = `attendance-${classId}-${startDate}-to-${endDate}.csv`;
      const contentDisposition = response.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportFeedback({
        type: "success",
        message: "Attendance export complete. Check your downloads folder for the CSV file.",
      });
    } catch (error) {
      console.error("Attendance export failed:", error);
      setExportFeedback({
        type: "error",
        message:
          "We couldn't export attendance right now. Please verify your connection and try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const displayStatus = (status) =>
    status === "Present" || status === "Absent" ? status : status || "Unknown";

  return (
    <TeacherLayout title={classId ? `${classId} Overview` : "Class Overview"}>
      <div className="space-y-6 text-gray-900 dark:text-slate-100">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <Link
            to="/teacher/classes"
            className="text-sm font-medium text-unt-green hover:text-unt-green dark:text-unt-green/90 dark:hover:text-unt-green"
          >
            ← Back to classes
          </Link>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded bg-unt-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-unt-green/90 focus:outline-none focus:ring-2 focus:ring-unt-green focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Add Attendance
          </button>
        </div>

        {/* Attendance snapshot */}
        <section className="rounded-lg bg-white p-6 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Attendance Overview</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            Review class-wide attendance at a glance.
          </p>
          <div className="mt-6 flex justify-start">
            <ClassAttendanceChart attendanceSummary={attendanceSummary} />
          </div>
        </section>

        {/* Student list */}
        <section className="rounded-lg bg-white p-6 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-2xl font-semibold">Student List</h2>

          {/* Search (non-functional placeholder for now) */}
          <input
            type="text"
            placeholder="Search student name"
            className="mb-4 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
            aria-label="Search student"
          />

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Loading attendance records…</p>
          ) : attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No attendance records found for this class yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {attendanceRecords.map((record) => (
                <li
                  key={record.id}
                  className="grid grid-cols-[2fr,auto,auto,auto] items-center gap-4 rounded-lg bg-gray-100 p-4 shadow dark:bg-slate-800"
                >
                  <div>
                    <span className="text-lg font-semibold">{record.studentName}</span>
                    {record.formattedDate ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400">{record.formattedDate}</p>
                    ) : null}
                  </div>
                  <span className={statusBadgeClasses(record.status)}>
                    {displayStatus(record.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openModal(record)}
                    className="rounded bg-unt-green px-3 py-1 text-white transition hover:bg-unt-green dark:bg-unt-green dark:hover:bg-unt-green/90"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDeleteRecord(record)}
                    disabled={isDeletingId === record.id}
                    className={`rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 ${
                      isDeletingId === record.id ? "cursor-not-allowed opacity-70" : ""
                    }`}
                  >
                    {isDeletingId === record.id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Export Attendance */}
        <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">Export Attendance</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Choose the date range you would like to export. A CSV file will be generated with all
            records that match your selection.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
                htmlFor="attendance-start-date"
              >
                Start date
              </label>
              <input
                id="attendance-start-date"
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
                htmlFor="attendance-end-date"
              >
                End date
              </label>
              <input
                id="attendance-end-date"
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportAttendance}
              disabled={isExporting}
              className={`rounded bg-green-500 px-6 py-2 font-semibold text-white transition hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 dark:bg-unt-green dark:hover:bg-unt-green/90 dark:focus:ring-unt-green/60 dark:focus:ring-offset-slate-900 ${
                isExporting ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              {isExporting ? "Exporting…" : "Export Attendance"}
            </button>
          </div>

          {exportFeedback && (
            <p
              className={`text-sm ${
                exportFeedback.type === "error" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              }`}
            >
              {exportFeedback.message}
            </p>
          )}
        </section>
      </div>

      {/* Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Add Attendance</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Create a new attendance record for this class.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Student Name</label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(event) => setNewStudentName(event.target.value)}
                  placeholder="Alex Johnson"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Provide the student's full name.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Student ID (optional)</label>
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(event) => setNewStudentId(event.target.value)}
                  placeholder="123456"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

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
                  <option value="Late">Late</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAttendance}
                disabled={isCreating}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  isCreating
                    ? "cursor-not-allowed bg-unt-green dark:bg-unt-green"
                    : "bg-unt-green hover:border-unt-green dark:bg-unt-green dark:hover:bg-unt-green/90"
                }`}
              >
                {isCreating ? "Saving…" : "Add attendance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Edit Attendance</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Student: <strong>{selectedRecord.studentName}</strong>
            </p>

            {/* Date */}
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

            {/* Status */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Attendance Status</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
              </select>
            </div>

            {/* Reason */}
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

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
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

export default TeacherClassView;
