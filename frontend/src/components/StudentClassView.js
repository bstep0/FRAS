import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

const StudentClassView = () => {
  const { classId } = useParams();
  const [attendanceRecords, setAttendanceRecords] = useState([]); // Attendance records
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // Current month index 
  const [selectedDate, setSelectedDate] = useState(null); // Selected date for details view
  const user = auth.currentUser;

  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      if (!user) return;

      try {
        // Fetch user information based on email
        const usersRef = collection(db, "users"); 
        const userQuery = query(usersRef, where("email", "==", user.email));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
          console.warn("No user doc found for email:", user.email);
          return;
        }

        const studentDoc = userSnapshot.docs[0];
        const studentId = studentDoc.id; 

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

  const getAttendanceStatus = (date) => {
    const record = attendanceRecords.find((r) => {
      if (!r.date || !r.date.toDate) return false; 
      const recordDate = r.date.toDate(); 

      return (
        recordDate.getFullYear() === date.getFullYear() &&
        recordDate.getMonth() === date.getMonth() &&
        recordDate.getDate() === date.getDate()
      );
    });

    return record ? record.status : "Unknown";
  };

  // Generates the calendar for the current month and fills in the previous and next month days to complete the grid. 
  const generateCalendarDays = () => {
    const year = new Date().getFullYear();
    const firstDayOfMonth = new Date(year, currentMonth, 1);
    const lastDayOfMonth = new Date(year, currentMonth + 1, 0);

    const days = [];
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    // Include days from the previous month
    const prevMonthLastDay = new Date(year, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, currentMonth - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        status: getAttendanceStatus(date),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, currentMonth, i);
      days.push({
        date,
        isCurrentMonth: true,
        status: getAttendanceStatus(date),
      });
    }

    // Include days from the next month
    const remaining = 42 - days.length; 
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, currentMonth + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        status: getAttendanceStatus(date),
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => (prev === 0 ? 11 : prev - 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => (prev === 11 ? 0 : prev + 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
  };

  const monthYearText = new Date(new Date().getFullYear(), currentMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const days = generateCalendarDays();

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

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Attendance for {classId}</h1>

        {/* Month Nav Buttons */}
        <div className="flex items-center justify-center mb-4 space-x-2">
          <button
            onClick={handlePrevMonth}
            className="bg-blue-600 text-white text-sm px-2 py-1 rounded hover:scale-105 transition-transform"
          >
            Previous
          </button>
          <h2 className="text-xl font-semibold">{monthYearText}</h2>
          <button
            onClick={handleNextMonth}
            className="bg-blue-600 text-white text-sm px-2 py-1 rounded hover:scale-105 transition-transform"
          >
            Next
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Attendance Calendar</h2>

          {/* Days of the Week */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-gray-600">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Full Calendar */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((dayObj, idx) => {
              const { date, isCurrentMonth, status } = dayObj;

              let symbol = "⬜";
              let textColor = isCurrentMonth ? "text-gray-700" : "text-gray-400";

              if (status === "Present") {
                symbol = "Present ✅";
                textColor = isCurrentMonth ? "text-green-600" : "text-green-400";
              } else if (status === "Absent") {
                symbol = "Absent ❌";
                textColor = isCurrentMonth ? "text-red-600" : "text-red-400";
              } else if (status === "Late") {
                symbol = "Late ⚠️";
                textColor = isCurrentMonth ? "text-yellow-500" : "text-yellow-300";
              }

              const isSelected =
                selectedDate && selectedDate.date.toDateString() === date.toDateString()
                  ? "border-2 border-blue-400"
                  : "";

              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick({ date, status })}
                  className={`p-4 border rounded-lg text-center cursor-pointer transition-transform hover:scale-105 hover:bg-gray-100 ${textColor} ${isSelected}`}
                >
                  <p className="text-gray-700">{date.getDate()}</p>
                  <p className="text-2xl">{symbol}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">
              Details for {selectedDate.date.toLocaleDateString("en-US")}
            </h3>
            <p>Status: {selectedDate.status}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentClassView;
