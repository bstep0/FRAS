import React, { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import FaceScanner from "../components/FaceScanner";

const StudentDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [studentId, setStudentId] = useState("");
  const user = auth.currentUser;

  const [showScanFlow, setShowScanFlow] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  
  // Load student classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;

      try {
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", user.email));
        const userSnap = await getDocs(qUser);

        if (userSnap.empty) {
          setClasses([]);
          return;
        }

        const studentDoc = userSnap.docs[0];
        const studentData = studentDoc.data();
        setStudentId(studentDoc.id);
        const enrolledClassIds = studentData.classes || [];

        if (enrolledClassIds.length === 0) {
          setClasses([]);
          return;
        }
        let fetchedClasses = [];
        for (let classId of enrolledClassIds) {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          if (classSnap.exists()) {
            const classData = classSnap.data();
            
            // Fetch teacher name
            let teacherName = "";
            const teacherId = classData.teacher;
            if (teacherId) {
              const teacherRef = doc(db, "users", teacherId);
              const teacherSnap = await getDoc(teacherRef);
              if (teacherSnap.exists()) {
                const teacherData = teacherSnap.data();
                teacherName = `${teacherData.fname} ${teacherData.lname}`;
              } else {
                teacherName = teacherId;
              }
            }
        
            fetchedClasses.push({
              id: classSnap.id,
              name: classData.name,
              teacher: teacherName,
              room: classData.room,
              schedule: classData.schedule,
            });
          }
        }
        
        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };

    fetchClasses();
  }, [user]);

  const refreshAttendance = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
        <img src="/logo.png" alt="Face Recognition" className="w-24 mx-auto mb-6" />
        <h2 className="text-xl font-semibold mb-6">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/student" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📌 Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/student/classes" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📚 My Classes
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/student/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        {/* Attendance History Card */}
        <div className="bg-gray-200 p-6 rounded-lg mb-10">
          <h2 className="text-xl text-black font-semibold">Attendance History</h2>
          <p className="text-black">Check your attendance records</p>
          <div className="flex space-x-4 mt-4">
            <Link to="/student/classes" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              View History
            </Link>
          </div>
        </div>

        {/* Record Attendance Button */}
        <div className="bg-gray-200 px-4 py-2 rounded mb-10">
          <h2 className="text-xl text-black font-semibold">Record Attendance</h2>
          <p className="text-black">Scan your face to mark your attendance</p>
          <div className="flex space-x-4 mt-4">
            <button onClick={() => setShowScanFlow(!showScanFlow)} className="bg-green-600 text-white px-4 py-2 rounded mb-4">
              {showScanFlow ? "Cancel" : "Start Scan"}
            </button>
          </div>
        </div>
        {showScanFlow && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h3 className="text-xl font-semibold mb-2">Select Class to Scan</h3>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="border p-2 rounded mb-4">
              <option value="">-- Select a Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.id} - {cls.name}
                </option>
              ))}
            </select>

            {selectedClass && (
              <FaceScanner 
                selectedClass={selectedClass}  
                studentId={studentId} 
                refreshAttendance={refreshAttendance} 
              />
            )}
          </div>
        )}

        {/* My Classes Section */}
        <h2 className="text-2xl font-semibold mb-4">My Classes</h2>
        <ul className="space-y-4 mb-6">
          {classes.length > 0 ? (
            classes.map((classItem) => (
              <li key={classItem.id} className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{classItem.id} - {classItem.name}</h2>
                  <p className="text-gray-600">Teacher: {classItem.teacher}</p>
                  <p className="text-gray-600">Room: {classItem.room}</p>
                  <p className="text-gray-600">Scheduled Time: {classItem.schedule}</p>
                </div>
              </li>
            ))
          ) : (
            <p className="p-4">No enrolled classes found.</p>
          )}
        </ul>
      </main>
    </div>
  );
};

export default StudentDashboard;
