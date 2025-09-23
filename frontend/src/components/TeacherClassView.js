// The teacher's individual class view page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNotifications } from "../context/NotificationsContext";
import ClassAttendanceChart from "./ClassAttendanceChart";

const formatDateLabel = (date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const formatRecordDate = (value) => {
  if (!value) return "";

  if (typeof value.toDate === "function") {
    return formatDateLabel(value.toDate());
  }

  if (value instanceof Date) {
    return formatDateLabel(value);
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateLabel(parsed);
    }
  }

  if (value?.seconds) {
    const parsed = new Date(value.seconds * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateLabel(parsed);
    }
  }

  return "";
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
  const { className: classId } = useParams();

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [selectedDate, setSelectedDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
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

        return {
          ...record,
          student: studentData,
          studentName,
          formattedDate: formatRecordDate(record.date),
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
    const dates = [];
    for (let i = 0; i < 21; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(formatDateLabel(date));
    }

    if (selectedDate && !dates.includes(selectedDate)) {
      dates.unshift(selectedDate);
    }

    return dates;
  }, [selectedDate]);

  const dateOptions = useMemo(() => generateDateOptions(), [generateDateOptions]);

  const openModal = (record) => {
    if (!record) return;

    const normalizedStatus = record.status === "Present" ? "Present" : "Absent";

    setSelectedRecord(record);
    setAttendanceStatus(normalizedStatus);
    setSelectedDate(record.formattedDate || "");
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

  const handleSave = async () => {
    if (!selectedRecord) {
      return;
    }

    const normalizedStatus = attendanceStatus === "Present" ? "Present" : "Absent";

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

    try {
      const attendanceDocRef = doc(db, "attendance", selectedRecord.id);
      await updateDoc(attendanceDocRef, {
        status: normalizedStatus,
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        editReason: editReason.trim(),
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

  const statusBadgeClasses = (status) => {
    const normalizedStatus = status === "Present" ? "Present" : status === "Absent" ? "Absent" : "Other";

    if (normalizedStatus === "Present") {
      return "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700";
    }

    if (normalizedStatus === "Absent") {
      return "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700";
    }

    return "rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700";
  };

  const displayStatus = (status) =>
    status === "Present" || status === "Absent" ? status : status || "Unknown";

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="min-h-screen w-64 border-r bg-white p-6">
        <img
          src="/logo.png"
          alt="Face Recognition Attendance"
          className="mx-auto mb-6 w-24"
        />
        <h2 className="mb-6 text-xl font-semibold">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link
                to="/teacher"
                className="flex items-center rounded p-2 hover:bg-gray-200"
              >
                📌 Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/teacher/classes"
                className="flex items-center rounded p-2 hover:bg-gray-200"
              >
                📚 My Classes
              </Link>
            </li>
            <li className="mb-4">
              <Link
                to="/teacher/messages"
                className="flex items-center rounded p-2 hover:bg-gray-200"
              >
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-3xl font-bold">
          {classId ? `${classId} Overview` : "Class Overview"}
        </h1>

        {/* Pie Chart */}
        <div className="mb-6 flex justify-start">
          <ClassAttendanceChart />
        </div>

        {/* Attendance Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">Student List</h2>
          <input
            type="text"
            placeholder="Search student name"
            className="mb-4 w-full rounded border p-2"
          />

          {/* Student List */}
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading attendance records…</p>
          ) : attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-500">
              No attendance records found for this class yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {attendanceRecords.map((record) => (
                <li
                  key={record.id}
                  className="grid grid-cols-[2fr,auto,auto] items-center gap-4 rounded-lg bg-gray-100 p-4 shadow"
                >
                  <div>
                    <span className="text-lg font-semibold">{record.studentName}</span>
                    {record.formattedDate ? (
                      <p className="text-sm text-gray-500">{record.formattedDate}</p>
                    ) : null}
                  </div>
                  <span className={statusBadgeClasses(record.status)}>
                    {displayStatus(record.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openModal(record)}
                    className="rounded bg-blue-500 px-3 py-1 text-white transition hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Export Attendance */}
        <button className="rounded bg-green-500 px-6 py-2 text-white hover:bg-green-600">
          Export Attendance
        </button>
      </main>

      {/* Modal Window */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">Edit Attendance</h2>
            <p className="text-gray-600">
              Student: <strong>{selectedRecord.studentName}</strong>
            </p>

            {/* Dropdown for date*/}
            <div className="mt-4 w-full">
              <label className="mb-2 block text-gray-700">Select Date:</label>
              <select
                className="w-full rounded border p-2"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {dateOptions.map((dateOption) => (
                  <option key={dateOption} value={dateOption}>
                    {dateOption}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown for attendance status */}
            <div className="mt-4 w-full">
              <label className="mb-2 block text-gray-700">Attendance Status:</label>
              <select
                className="w-full rounded border p-2"
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            <div className="mt-4 w-full">
              <label className="mb-2 block text-gray-700">Reason for edit (optional):</label>
              <textarea
                className="w-full resize-y rounded border p-2"
                rows={3}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why you're changing this record"
              />
            </div>

            {/* Save/Close Buttons */}
            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded bg-gray-500 px-4 py-2 text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`rounded px-4 py-2 text-white ${
                  isSaving
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-500 hover:bg-blue-700"
                }`}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassView;
