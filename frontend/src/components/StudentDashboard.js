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
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Attendance History</h2>
          <p className="mt-2 text-sm text-gray-600">Review your attendance records for each course.</p>
          <div className="mt-4">
            <Link
              to="/student/classes"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View History
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Record Attendance</h2>
          <p className="mt-2 text-sm text-gray-600">Scan your face to mark your attendance for a class.</p>
          <div className="mt-4 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowScanFlow((prev) => !prev)}
              className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 md:w-auto"
            >
              {showScanFlow ? "Cancel" : "Start Scan"}
            </button>

            {showScanFlow ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-lg font-semibold text-gray-900">Select Class</h3>
                <p className="mt-1 text-sm text-gray-600">Choose the class you want to check in for and begin scanning.</p>
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select a class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.id} - {cls.name}
                    </option>
                  ))}
                </select>

                {selectedClass ? (
                  <div className="mt-4">
                    <FaceScanner selectedClass={selectedClass} studentId={studentId} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Classes</h2>
            <Link
              to="/student/classes"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {isLoadingClasses ? (
              <p className="text-sm text-gray-500">Loading classes…</p>
            ) : hasClasses ? (
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
                    View class
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No enrolled classes found.</p>
            )}
          </div>
        </section>
      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;
