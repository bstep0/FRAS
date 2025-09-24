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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Courses</h2>
        <p className="mt-2 text-sm text-gray-600">
          Access details about each course and monitor your attendance performance.
        </p>
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading your classes…</p>
          ) : classes.length ? (
            classes.map((classItem) => (
              <div
                key={classItem.id}
                className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {classItem.id} - {classItem.name}
                  </p>
                  <p>Teacher: {classItem.teacher || "TBD"}</p>
                  <p>Room: {classItem.room || "TBD"}</p>
                  <p>Scheduled Time: {classItem.schedule || "See syllabus"}</p>
                </div>
                <Link
                  to={`/student/classes/${classItem.id}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Class
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No enrolled classes found.</p>
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentClasses;
