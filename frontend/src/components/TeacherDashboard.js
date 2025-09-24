import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import TeacherLayout from "./TeacherLayout";
import { useNotifications } from "../context/NotificationsContext";

const TeacherDashboard = () => {
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [classes, setClasses] = useState([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      if (!user?.email) {
        if (isMounted) {
          setTeacherInfo(null);
          setClasses([]);
          setIsLoadingClasses(false);
        }
        return;
      }

      setIsLoadingClasses(true);

      try {
        const usersRef = collection(db, "users");
        const teacherQuery = query(usersRef, where("email", "==", user.email));
        const teacherSnapshot = await getDocs(teacherQuery);

        if (!isMounted) return;

        if (teacherSnapshot.empty) {
          setTeacherInfo(null);
          setClasses([]);
          setIsLoadingClasses(false);
          return;
        }

        const teacherDoc = teacherSnapshot.docs[0];
        const teacherData = teacherDoc.data();
        const teacherName = [teacherData.fname, teacherData.lname]
          .filter(Boolean)
          .join(" ");

        setTeacherInfo({
          id: teacherDoc.id,
          name:
            teacherName ||
            teacherData.displayName ||
            teacherData.name ||
            user.displayName ||
            user.email,
        });

        const classIds = Array.isArray(teacherData.classes)
          ? teacherData.classes.filter(Boolean)
          : [];

        let fetchedClasses = [];

        if (classIds.length) {
          fetchedClasses = await Promise.all(
            classIds.map(async (classId) => {
              try {
                const classRef = doc(db, "classes", classId);
                const classSnap = await getDoc(classRef);
                if (!classSnap.exists()) {
                  return null;
                }
                return { id: classSnap.id, ...classSnap.data() };
              } catch (error) {
                console.error(`Failed to fetch class ${classId}`, error);
                return null;
              }
            })
          );
        } else {
          const classesRef = collection(db, "classes");
          const classesQuery = query(classesRef, where("teacher", "==", teacherDoc.id));
          const classesSnapshot = await getDocs(classesQuery);
          fetchedClasses = classesSnapshot.docs.map((classDoc) => ({
            id: classDoc.id,
            ...classDoc.data(),
          }));
        }

        if (!isMounted) return;

        const normalizedClasses = fetchedClasses
          .filter(Boolean)
          .map((classData) => {
            const studentList =
              classData.students ||
              classData.studentIds ||
              classData.enrolledStudents ||
              [];
            const studentCount = Array.isArray(studentList)
              ? studentList.length
              : Number(classData.studentCount || classData.enrollment) || 0;

            return {
              id: classData.id,
              name: classData.name || classData.title || "Untitled class",
              room: classData.room || classData.location || "",
              schedule: classData.schedule || classData.time || "",
              studentCount,
            };
          });

        setClasses(normalizedClasses);
      } catch (error) {
        console.error("Error fetching teacher dashboard data:", error);
        pushToast({
          tone: "error",
          title: "Unable to load dashboard",
          message:
            "We couldn't load your dashboard data right now. Please try again shortly.",
        });
        if (isMounted) {
          setTeacherInfo((previous) => previous || null);
          setClasses([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingClasses(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user, pushToast]);

  const totalStudents = useMemo(() => {
    if (!classes.length) return 0;
    return classes.reduce((sum, classItem) => sum + (classItem.studentCount || 0), 0);
  }, [classes]);

  const hasClasses = classes.length > 0;

  return (
    <TeacherLayout title="Dashboard">
      <div className="space-y-8">
        <section className="glass-card">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Welcome, {teacherInfo?.name || "Teacher"}
          </h2>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-unt-green/10 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
              <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Active Classes</dt>
              <dd className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{classes.length}</dd>
            </div>
            <div className="rounded-2xl border border-unt-green/10 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
              <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Enrolled Students</dt>
              <dd className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{totalStudents}</dd>
            </div>
          </dl>
        </section>

        <section className="glass-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">My Classes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">View class rosters and manage attendance.</p>
            </div>
            <Link to="/teacher/classes" className="brand-button--ghost">
              View All
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {isLoadingClasses ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Loading your classes…</p>
            ) : hasClasses ? (
              classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex flex-col gap-3 rounded-2xl border border-unt-green/10 bg-white/90 p-5 text-sm text-slate-700 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{classItem.name}</p>
                    <p className="text-sm">Room: {classItem.room || "TBD"}</p>
                    <p className="text-sm">Schedule: {classItem.schedule || "See syllabus"}</p>
                    <p className="text-sm">Students Enrolled: {classItem.studentCount}</p>
                  </div>
                  <Link to={`/teacher/classes/${classItem.id}`} className="brand-button md:self-start">
                    Open Class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">No classes assigned yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-dashed border-unt-green/30 bg-white/80 p-6 text-sm text-slate-600 shadow-inner dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Attendance Updates</h2>
          <p className="mt-2">
            Attendance activity from your classes will appear here as soon as students begin checking in.
          </p>
        </section>
      </div>
    </TeacherLayout>
  );
};

export default TeacherDashboard;
