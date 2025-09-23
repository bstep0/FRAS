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
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome back, {teacherInfo?.name || "Teacher"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Review your schedule, track attendance, and stay in touch with your students.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <dt className="text-sm font-medium text-gray-600">Active classes</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{classes.length}</dd>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <dt className="text-sm font-medium text-gray-600">Enrolled students</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{totalStudents}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Classes</h2>
            <Link
              to="/teacher/classes"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {isLoadingClasses ? (
              <p className="text-sm text-gray-500">Loading your classes…</p>
            ) : hasClasses ? (
              classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {classItem.name}
                    </p>
                    <p>Room: {classItem.room || "TBD"}</p>
                    <p>Schedule: {classItem.schedule || "See syllabus"}</p>
                    <p>Students enrolled: {classItem.studentCount}</p>
                  </div>
                  <Link
                    to={`/teacher/classes/${classItem.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No classes assigned yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Recent attendance updates</h2>
          <p className="mt-2">
            Attendance activity from your classes will appear here as soon as students begin checking in.
          </p>
        </section>
      </div>
    </TeacherLayout>
  );
};

export default TeacherDashboard;
