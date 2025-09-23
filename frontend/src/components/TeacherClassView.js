import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ClassAttendanceChart from "./ClassAttendanceChart";
import TeacherLayout from "./TeacherLayout";

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

  return (
    <TeacherLayout title={`${className} Overview`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/teacher/classes" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            ← Back to classes
          </Link>
          <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Export Attendance
          </button>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Attendance snapshot</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review class-wide attendance performance at a glance.
          </p>
          <div className="mt-6 flex justify-start">
            <ClassAttendanceChart />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Student list</h2>
              <p className="mt-1 text-sm text-gray-600">
                Update attendance statuses for individual students.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search student name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
          </div>

          <ul className="mt-6 space-y-4">
            {students.map((student, index) => (
              <li
                key={index}
                className="flex flex-col gap-4 rounded-md border border-gray-100 bg-gray-50 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <span className="text-base font-semibold text-gray-900">{student.name}</span>
                <button
                  type="button"
                  onClick={() => openModal(student)}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Edit attendance
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900">Edit Attendance</h2>
            <p className="mt-2 text-sm text-gray-600">
              Student: <strong>{selectedStudent.name}</strong>
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Select date</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                {generateDateOptions().map((date, index) => (
                  <option key={index} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Attendance status</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
};

export default TeacherClassView;
