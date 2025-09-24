import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import StudentLayout from "./StudentLayout";
import FaceScanner from "./FaceScanner";
import { useNotifications } from "../context/NotificationsContext";

const StudentDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [showScanFlow, setShowScanFlow] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const { pushToast } = useNotifications();

  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchClasses = async () => {
      if (!user) {
        if (isMounted) {
          setClasses([]);
          setIsLoadingClasses(false);
        }
        return;
      }

      setIsLoadingClasses(true);

      try {
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", user.email));
        const userSnap = await getDocs(qUser);

        if (!isMounted) return;

        if (userSnap.empty) {
          setClasses([]);
          setIsLoadingClasses(false);
          return;
        }

        const studentDoc = userSnap.docs[0];
        const studentData = studentDoc.data();
        setStudentId(studentDoc.id);
        const enrolledClassIds = studentData.classes || [];

        if (!enrolledClassIds.length) {
          setClasses([]);
          setIsLoadingClasses(false);
          return;
        }

        const fetchedClasses = await Promise.all(
          enrolledClassIds.map(async (classId) => {
            try {
              const classRef = doc(db, "classes", classId);
              const classSnap = await getDoc(classRef);
              if (!classSnap.exists()) {
                return null;
              }
              const classData = classSnap.data();

              let teacherName = "";
              const teacherId = classData.teacher;
              if (teacherId) {
                try {
                  const teacherRef = doc(db, "users", teacherId);
                  const teacherSnap = await getDoc(teacherRef);
                  if (teacherSnap.exists()) {
                    const teacherData = teacherSnap.data();
                    teacherName = `${teacherData.fname} ${teacherData.lname}`;
                  } else {
                    teacherName = teacherId;
                  }
                } catch (error) {
                  console.error("Error fetching teacher info:", error);
                  teacherName = teacherId;
                }
              }

              return {
                id: classSnap.id,
                name: classData.name,
                teacher: teacherName,
                room: classData.room,
                schedule: classData.schedule,
              };
            } catch (error) {
              console.error(`Failed to fetch class ${classId}`, error);
              return null;
            }
          })
        );

        if (!isMounted) return;

        setClasses(fetchedClasses.filter(Boolean));
      } catch (error) {
        console.error("Error fetching classes:", error);
        pushToast({
          tone: "error",
          title: "Unable to load classes",
          message: "Something went wrong while loading your classes. Please try again soon.",
        });
        if (isMounted) {
          setClasses([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingClasses(false);
        }
      }
    };

    fetchClasses();

    return () => {
      isMounted = false;
    };
  }, [user, pushToast]);

  const hasClasses = classes.length > 0;

  return (
    <StudentLayout title="Dashboard">
      <div className="space-y-8">
        <section className="glass-card">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Attendance History</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review your attendance records for each course.</p>
          <div className="mt-6">
            <Link to="/student/classes" className="brand-button">
              View history
            </Link>
          </div>
        </section>

        <section className="glass-card">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Record Attendance</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Scan your face to mark your attendance for a class.</p>
          <div className="mt-6 flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setShowScanFlow((prev) => !prev)}
              className={`${showScanFlow ? "brand-button--ghost" : "brand-button"} w-full justify-center md:w-auto`}
            >
              {showScanFlow ? "Cancel" : "Start Scan"}
            </button>

            {showScanFlow ? (
              <div className="rounded-2xl border border-unt-green/10 bg-white/90 p-5 shadow-inner dark:border-slate-700/60 dark:bg-slate-900/70">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Class</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose the class you want to check in for and begin scanning.</p>
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="mt-4 w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                >
                  <option value="">Select A Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.id} · {cls.name}
                    </option>
                  ))}
                </select>

                {selectedClass ? (
                  <div className="mt-4 rounded-2xl border border-unt-green/10 bg-white/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                    <FaceScanner selectedClass={selectedClass} studentId={studentId} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="glass-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">My Classes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Quick access to the courses you are enrolled in this term.</p>
            </div>
            <Link to="/student/classes" className="brand-button--ghost">
              View All
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {isLoadingClasses ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Loading classes…</p>
            ) : hasClasses ? (
              classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex flex-col gap-3 rounded-2xl border border-unt-green/10 bg-white/90 p-5 text-sm text-slate-700 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {classItem.id} · {classItem.name}
                    </p>
                    <p className="text-sm">Instructor: {classItem.teacher || "TBD"}</p>
                    <p className="text-sm">Room: {classItem.room || "TBD"}</p>
                    <p className="text-sm">Schedule: {classItem.schedule || "See syllabus"}</p>
                  </div>
                  <Link to={`/student/classes/${classItem.id}`} className="brand-button md:self-start">
                    View class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">No enrolled classes found.</p>
            )}
          </div>
        </section>
      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;
