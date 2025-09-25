import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import TeacherLayout from "./TeacherLayout";
import { useNotifications } from "../context/NotificationsContext";

const TeacherClasses = () => {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchClasses = async () => {
      if (!user?.email) {
        if (isMounted) {
          setClasses([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const usersRef = collection(db, "users");
        const teacherQuery = query(usersRef, where("email", "==", user.email));
        const teacherSnapshot = await getDocs(teacherQuery);

        if (!isMounted) return;

        if (teacherSnapshot.empty) {
          setClasses([]);
          setIsLoading(false);
          return;
        }

        const teacherDoc = teacherSnapshot.docs[0];
        const teacherData = teacherDoc.data();
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

        const normalized = fetchedClasses
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

        setClasses(normalized);
      } catch (error) {
        console.error("Error fetching teacher classes:", error);
        pushToast({
          tone: "error",
          title: "Unable to load classes",
          message: "We couldn't load your classes right now. Please try again shortly.",
        });
        if (isMounted) {
          setClasses([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchClasses();

    return () => {
      isMounted = false;
    };
  }, [user, pushToast]);

  return (
    <TeacherLayout title="My Classes">
      <div className="space-y-6">
        <section className="glass-card">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">All Classes</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            View class rosters and manage your class attendance.
          </p>
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Loading classes…</p>
            ) : classes.length ? (
              classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex flex-col gap-3 rounded-2xl border border-unt-green/10 bg-white/90 p-5 text-sm text-slate-700 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{classItem.name}</p>
                    <p>Room: {classItem.room || "TBD"}</p>
                    <p>Schedule: {classItem.schedule || "See syllabus"}</p>
                    <p>Students enrolled: {classItem.studentCount}</p>
                  </div>
                  <Link
                    to={`/teacher/classes/${classItem.id}`}
                    className="brand-button md:self-start"
                  >
                    View Class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">No classes assigned yet.</p>
            )}
          </div>
        </section>

        <section className="glass-card text-sm text-slate-600 dark:text-slate-300">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Attendance Updates</h3>
          <p className="mt-2">
            Attendance updates will appear here when students begin checking in.
          </p>
        </section>
      </div>
    </TeacherLayout>
  );
};

export default TeacherClasses;
