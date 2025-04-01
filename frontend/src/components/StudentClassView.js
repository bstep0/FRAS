import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

const StudentClassView = () => {
  const { classId } = useParams();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [selectedDate, setSelectedDate] = useState(null);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      if (!user) return;

      try {
        const usersRef = collection(db, "users");
        const userQuery = query(usersRef, where("email", "==", user.email));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
          console.warn("No user doc found for email:", user.email);
          return;
        }

        const studentDoc = userSnapshot.docs[0];
        const studentData = studentDoc.data();
        const studentId = studentData.id;

        const attendanceRef = collection(db, "attendance");
        const attendanceQuery = query(
          attendanceRef,
          where("classID", "==", classId),
          where("studentID", "==", studentId)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);

        let records = [];
        attendanceSnapshot.forEach((doc) => {
          records.push(doc.data());
        });

        setAttendanceRecords(records);
      } catch (error) {
        console.error("Error fetching attendance records:", error);
      }
    };

    fetchAttendanceRecords();
  }, [user, classId]);

  // ---------------- CALENDAR LOGIC ----------------

  const generateSemesterDays = () => {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 4, 31); 
    let days = [];

    let current = new Date(start);
    while (current <= end) {
      const formattedDate = current.toLocaleDateString("en-US");
      days.push({
        date: new Date(current),
        formatted: formattedDate,
        status: "Unknown",
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const semesterDays = generateSemesterDays().map((day) => {
    const record = attendanceRecords.find((r) => r.date === day.formatted);
    return record
      ? { ...day, status: record.status }
      : day;
  });

  const filteredDays = semesterDays.filter(
    (day) => day.date.getMonth() === currentMonth
  );

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => (prev === 0 ? 4 : prev - 1));
    setSelectedDate(null);
  };
  const handleNextMonth = () => {
    setCurrentMonth((prev) => (prev === 4 ? 0 : prev + 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
  };

  const monthYearText = new Date(new Date().getFullYear(), currentMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
        <img
          src="/logo.png"
          alt="Face Recognition Attendance"
          className="w-24 mx-auto mb-6"
        />
        <h2 className="text-xl font-semibold mb-6">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/student" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📌 Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/student/classes" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📚 My Classes
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/student/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Attendance for {classId}</h1>

        {/* Month Navigation */}
        <div className="flex items-center justify-center mb-4 space-x-2">
          <button onClick={handlePrevMonth} className="bg-blue-600 text-white text-sm px-2 py-1 rounded hover:scale-105 transition-transform">
            Previous
          </button>
          <h2 className="text-xl font-semibold">{monthYearText}</h2>
          <button onClick={handleNextMonth} className="bg-blue-600 text-white text-sm px-2 py-1 rounded hover:scale-105 transition-transform">
            Next
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Attendance Calendar</h2>

          {/* Days of the Week Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-gray-600">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Render Days */}
          <div className="grid grid-cols-7 gap-2">
            {filteredDays.map((day, idx) => {
              let symbol = "⬜";
              let textColor = "text-gray-400";
              if (day.status === "Present") {
                symbol = "Present ✅";
                textColor = "text-green-600";
              } else if (day.status === "Absent") {
                symbol = "Absent ❌";
                textColor = "text-red-600";
              } else if (day.status === "Late") {
                symbol = "Late ⚠️";
                textColor = "text-yellow-500";
              }

              const isSelected =
                selectedDate && selectedDate.formatted === day.formatted
                  ? "border-2 border-blue-400"
                  : "";

              return (
                <div key={idx} onClick={() => handleDateClick(day)} className={`p-4 border rounded-lg text-center cursor-pointer transition-transform hover:scale-105 hover:bg-gray-100 ${textColor} ${isSelected}`}>
                  <p className="text-gray-700">{day.formatted}</p>
                  <p className="text-2xl">{symbol}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">
              Details for {selectedDate.formatted}
            </h3>
            <p>Status: {selectedDate.status}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentClassView;
