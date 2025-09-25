import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import StudentLayout from "./StudentLayout";
import { useNotifications } from "../context/NotificationsContext";

const StudentClasses = () => {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast } = useNotifications();
  const user = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const fetchClasses = async () => {
      if (!user) {
        if (isMounted) {
          setClasses([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (!isMounted) return;

        if (querySnapshot.empty) {
          setClasses([]);
          setIsLoading(false);
          return;
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data();
        const enrolledClassIds = studentData.classes || [];

        if (!enrolledClassIds.length) {
          setClasses([]);
          setIsLoading(false);
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
                  console.error("Error fetching teacher information:", error);
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
          message: "We could not load your classes right now. Please try again shortly.",
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
    <StudentLayout title="My Classes">
      <div className="glass-card">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Courses</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Access details about each course and monitor your attendance performance.
        </p>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">Loading your classes…</p>
          ) : classes.length ? (
            classes.map((classItem) => (
              <div
                key={classItem.id}
                className="flex flex-col gap-3 rounded-2xl border border-unt-green/10 bg-white/90 p-5 text-sm text-slate-700 shadow-sm transition hover:border-unt-green/30 hover:shadow-brand dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    {classItem.id} - {classItem.name}
                  </p>
                  <p>Teacher: {classItem.teacher || "TBD"}</p>
                  <p>Room: {classItem.room || "TBD"}</p>
                  <p>Scheduled Time: {classItem.schedule || "See syllabus"}</p>
                </div>
                <Link
                  to={`/student/classes/${classItem.id}`}
                  className="brand-button md:self-start"
                >
                  View Class
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-300">No enrolled classes found.</p>
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentClasses;
