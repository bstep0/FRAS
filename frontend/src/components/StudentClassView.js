import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import StudentLayout from "./StudentLayout";
import { useNotifications } from "../context/NotificationsContext";

const StudentClassView = () => {
  const { classId } = useParams();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchAttendanceRecords = async () => {
      if (!user) {
        if (isMounted) {
          setAttendanceRecords([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const usersRef = collection(db, "users");
        const userQuery = query(usersRef, where("email", "==", user.email));
        const userSnapshot = await getDocs(userQuery);

        if (!isMounted) return;

        if (userSnapshot.empty) {
          console.warn("No user doc found for email:", user.email);
          setAttendanceRecords([]);
          setIsLoading(false);
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

        if (!isMounted) return;

        const records = [];
        attendanceSnapshot.forEach((docSnapshot) => {
          records.push(docSnapshot.data());
        });

        setAttendanceRecords(records);
      } catch (error) {
        console.error("Error fetching attendance records:", error);
        pushToast({
          tone: "error",
          title: "Attendance unavailable",
          message: "We couldn't retrieve your attendance records. Please try again soon.",
        });
        if (isMounted) {
          setAttendanceRecords([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAttendanceRecords();

    return () => {
      isMounted = false;
    };
  }, [user, classId, pushToast]);

  const getAttendanceStatus = (date) => {
    const record = attendanceRecords.find((recordItem) => {
      if (!recordItem.date || !recordItem.date.toDate) return false;
      const recordDate = recordItem.date.toDate();

      return (
        recordDate.getFullYear() === date.getFullYear() &&
        recordDate.getMonth() === date.getMonth() &&
        recordDate.getDate() === date.getDate()
      );
    });

    return record ? record.status : "Unknown";
  };

  const generateCalendarDays = () => {
    const year = new Date().getFullYear();
    const firstDayOfMonth = new Date(year, currentMonth, 1);
    const lastDayOfMonth = new Date(year, currentMonth + 1, 0);

    const days = [];
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const prevMonthLastDay = new Date(year, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i -= 1) {
      const date = new Date(year, currentMonth - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        status: getAttendanceStatus(date),
      });
    }

    for (let i = 1; i <= daysInMonth; i += 1) {
      const date = new Date(year, currentMonth, i);
      days.push({
        date,
        isCurrentMonth: true,
        status: getAttendanceStatus(date),
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i += 1) {
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
    <StudentLayout title={`Attendance for ${classId}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/student/classes" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            ← Back to classes
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Attendance Calendar</h2>
            <p className="text-sm text-gray-600">{monthYearText}</p>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2 text-center text-sm font-semibold text-gray-600">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((dayObj, idx) => {
              const { date, isCurrentMonth, status } = dayObj;
              let statusLabel = "⬜";
              let textColor = isCurrentMonth ? "text-gray-700" : "text-gray-400";

              if (status === "Present") {
                statusLabel = "Present ✅";
                textColor = isCurrentMonth ? "text-green-600" : "text-green-400";
              } else if (status === "Absent") {
                statusLabel = "Absent ❌";
                textColor = isCurrentMonth ? "text-red-600" : "text-red-400";
              } else if (status === "Late") {
                statusLabel = "Late ⚠️";
                textColor = isCurrentMonth ? "text-yellow-500" : "text-yellow-300";
              }

              const isSelected =
                selectedDate &&
                selectedDate.date.toDateString() === date.toDateString()
                  ? "border-2 border-blue-400"
                  : "";

              return (
                <button
                  key={`${date.toISOString()}-${idx}`}
                  type="button"
                  onClick={() => handleDateClick({ date, status })}
                  className={`flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-medium hover:bg-gray-100 ${textColor} ${isSelected}`}
                >
                  <span>{date.getDate()}</span>
                  <span className="mt-1 text-xs">{statusLabel}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading attendance records…</p>
          ) : null}
        </section>

        {selectedDate ? (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">
              Details for {selectedDate.date.toLocaleDateString("en-US")}
            </h3>
            <p className="mt-2 text-sm text-gray-600">Status: {selectedDate.status}</p>
          </section>
        ) : null}
      </div>
    </StudentLayout>
  );
};

export default StudentClassView;
