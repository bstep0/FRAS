import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import StudentLayout from "./StudentLayout";
import { useNotifications } from "../context/NotificationsContext";

const statusStyles = {
  Present: {
    label: "Present",
    tone: "text-unt-green",
    dot: "bg-unt-green",
  },
  Absent: {
    label: "Absent",
    tone: "text-red-500",
    dot: "bg-red-500",
  },
  Late: {
    label: "Late",
    tone: "text-amber-500",
    dot: "bg-amber-500",
  },
  Unknown: {
    label: "No record",
    tone: "text-slate-400",
    dot: "bg-slate-400",
  },
};

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/student/classes"
            className="inline-flex items-center gap-2 text-sm font-semibold text-unt-green transition hover:text-unt-greenDark"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
              <path d="M21 12H9" />
            </svg>
            Back to classes
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="brand-button--ghost"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="brand-button"
            >
              Next
            </button>
          </div>
        </div>

        <section className="glass-card">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Attendance Calendar</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">{monthYearText}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-3">
            {days.map((dayObj, idx) => {
              const { date, isCurrentMonth, status } = dayObj;
              const meta = statusStyles[status] || statusStyles.Unknown;
              const isSelected =
                selectedDate && selectedDate.date.toDateString() === date.toDateString();

              const baseClasses = [
                "flex flex-col items-center justify-between rounded-2xl border p-3 text-sm transition",
                "bg-white/90 text-slate-700 shadow-sm hover:border-unt-green/40 hover:shadow-brand dark:bg-slate-900/70 dark:text-slate-200",
                isCurrentMonth ? "border-unt-green/10" : "border-slate-200/60 opacity-60 dark:border-slate-700/60",
                isSelected ? "ring-2 ring-unt-green" : "",
              ].join(" ");

              return (
                <button
                  key={`${date.toISOString()}-${idx}`}
                  type="button"
                  onClick={() => handleDateClick({ date, status })}
                  className={baseClasses}
                >
                  <span className="text-lg font-semibold">{date.getDate()}</span>
                  <span className={`mt-2 inline-flex items-center gap-2 text-xs font-medium ${meta.tone}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-300">
            {Object.values(statusStyles).map((meta) => (
              <span key={meta.label} className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 dark:bg-slate-900/60">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
                <span className={meta.tone}>{meta.label}</span>
              </span>
            ))}
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">Loading attendance records…</p>
          ) : null}
        </section>

        {selectedDate ? (
          <section className="glass-card">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              Details for {selectedDate.date.toLocaleDateString("en-US")}
            </h3>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[selectedDate.status]?.dot || statusStyles.Unknown.dot}`} aria-hidden />
              {statusStyles[selectedDate.status]?.label || statusStyles.Unknown.label}
            </p>
          </section>
        ) : null}
      </div>
    </StudentLayout>
  );
};

export default StudentClassView;
