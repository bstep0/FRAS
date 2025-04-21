import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";

const StudentClasses = () => {
  const [classes, setClasses] = useState([]); // List of classes
  const [studentId, setStudentId] = useState(""); // Student ID
  const user = auth.currentUser;
  const [teacherNameCache, setTeacherNameCache] = useState({});

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;

      try {
      {/* Find the student document by email */}
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setClasses([]);
          return;
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data();
        const enrolledClassIds = studentData.classes || [];

        if (enrolledClassIds.length === 0) {
          setClasses([]);
          return;
        }

        let fetchedClasses = [];
        {/* For each classID, pull class data & teacher name */}
        for (let classId of enrolledClassIds) {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);

          if (!classSnap.exists()) {
            continue;
          }

          let classData = classSnap.data();
          let teacherId = classData.teacher;
          let teacherName = "";

          if (teacherNameCache[teacherId]) {
            teacherName = teacherNameCache[teacherId];
          } else {
            const teacherRef = doc(db, "users", teacherId);
            const teacherSnap = await getDoc(teacherRef);

            if (teacherSnap.exists()) {
              const teacherData = teacherSnap.data();
              teacherName = `${teacherData.fname} ${teacherData.lname}`;
              setTeacherNameCache((prev) => ({
                ...prev,
                [teacherId]: teacherName
              }));
            } else {
              teacherName = teacherId; 
            }
          }

          fetchedClasses.push({
            id: classSnap.id,
            name: classData.name,
            teacher: teacherName,
            room: classData.room,
            schedule: classData.schedule
          });
        }

        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };

    fetchClasses();
  }, [user]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
        <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/student" className="flex items-center p-2 hover:bg-gray-200 rounded">📌 Dashboard</Link>
            </li>
            <li className="mb-4">
              <Link to="/student/classes" className="flex items-center p-2 hover:bg-gray-200 rounded">📚 My Classes</Link>
            </li>
            <li className="mb-4">
              <Link to="/student/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">💬 Messages</Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Class list */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">My Classes</h1>
        <ul className="space-y-4">
          {classes.length > 0 ? (
            classes.map((classItem) => (
              <li key={classItem.id} className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{classItem.id} - {classItem.name}</h2>
                  <p className="text-gray-600">Teacher: {classItem.teacher}</p>
                  <p className="text-gray-600">Room: {classItem.room}</p>
                  <p className="text-gray-600">Scheduled Time: {classItem.schedule}</p>
                </div>
                <Link to={`/student/classes/${classItem.id}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">View</Link>
              </li>
            ))
          ) : (
            <p>No enrolled classes found.</p>
          )}
        </ul>
      </main>
    </div>
  );
};

export default StudentClasses;
