// The teacher's individual class view page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ClassAttendanceChart from "./ClassAttendanceChart";
import { auth } from "../firebaseConfig";
import { EXPORT_ATTENDANCE_ENDPOINT } from "../config/api";

const TeacherClassView = () => {
  const { className } = useParams();

  const [students, setStudents] = useState([
    { name: "Brendon Stepanek", status: "Present" },
    { name: "Josh Odegai", status: "Absent" },
    { name: "Maximiliano Hernandez", status: "Late" },
    { name: "Neel Patel", status: "Present" },
    { name: "Zain Jamal", status: "Absent" }
  ]);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [selectedDate, setSelectedDate] = useState(""); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  const generateDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 21; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const formattedDate = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      dates.push(formattedDate);
    }
    return dates;
  };

  const openModal = (student) => {
    setSelectedStudent(student);
    setAttendanceStatus(student.status);
    setSelectedDate(generateDateOptions()[0]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = () => {
    setStudents((prevStudents) =>
      prevStudents.map((s) =>
        s.name === selectedStudent.name ? { ...s, status: attendanceStatus } : s
      )
    );

    console.log(`Updated ${selectedStudent.name} to ${attendanceStatus} on ${selectedDate}`);
    closeModal();
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
      url.searchParams.set("classId", className);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        let errorMessage = "Unable to export attendance. Please try again later.";

        try {
          const data = await response.json();
          if (data && data.message) {
            errorMessage = data.message;
          }
        } catch (jsonError) {
          try {
            const text = await response.text();
            if (text) {
              errorMessage = text;
            }
          } catch (textError) {
            console.warn("Unable to parse error response", jsonError, textError);
          }
        }

        setExportFeedback({ type: "error", message: errorMessage });
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      let filename = `attendance-${className}-${startDate}-to-${endDate}.csv`;
      const contentDisposition = response.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
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
        message: "We couldn't export attendance right now. Please verify your connection and try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-xl font-semibold mb-6">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/teacher" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📌 Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/teacher/classes" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📚 My Classes
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/teacher/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">{className} Overview</h1>
        
        {/* Pie Chart */}
        <div className="mb-6 flex justify-start">
          <ClassAttendanceChart />
        </div>

        {/* Attendance Section */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-semibold mb-4">Student List</h2>
          <input
            type="text"
            placeholder="Search student name"
            className="w-full p-2 border rounded mb-4"
          />

          {/* Student List */}
          <ul className="space-y-4">
            {students.map((student, index) => (
              <li key={index} className="grid grid-cols-[2fr,0.15fr,auto] items-center bg-gray-100 p-4 rounded-lg shadow">
                <span className="text-lg font-semibold">{student.name}</span>
                <button onClick={() => openModal(student)} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700 ">
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Export Attendance */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-2xl font-semibold">Export Attendance</h2>
          <p className="text-sm text-gray-600">
            Choose the date range you would like to export. A CSV file will be generated with all records that
            match your selection.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="attendance-start-date">
                Start date
              </label>
              <input
                id="attendance-start-date"
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="attendance-end-date">
                End date
              </label>
              <input
                id="attendance-end-date"
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
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
              className={`rounded bg-green-500 px-6 py-2 font-semibold text-white transition hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 ${
                isExporting ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              {isExporting ? "Exporting…" : "Export Attendance"}
            </button>
            <span className="text-sm text-gray-500">
              Only teachers assigned to this class can export attendance data.
            </span>
          </div>
          {exportFeedback && (
            <p
              className={`text-sm ${
                exportFeedback.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {exportFeedback.message}
            </p>
          )}
        </div>
      </main>

      {/* Modal Window */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-4">Edit Attendance</h2>
            <p className="text-gray-600">Student: <strong>{selectedStudent.name}</strong></p>

            {/* Dropdown for date*/}
            <div className="mt-4 w-full">
              <label className="block text-gray-700 mb-2">Select Date:</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {generateDateOptions().map((date, index) => (
                  <option key={index} value={date}>{date}</option>
                ))}
              </select>
            </div>

            {/* Dropdown for attendance status */}
            <div className="mt-4 w-full">
              <label className="block text-gray-700 mb-2">Attendance Status:</label>
              <select
                className="w-full p-2 border rounded-md"
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
              </select>
            </div>

            {/* Save/Close Buttons */}
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={closeModal} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Cancel
              </button>
              <button onClick={handleSave} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassView;
