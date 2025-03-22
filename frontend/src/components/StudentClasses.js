import React from "react";
import { Link } from "react-router-dom";

const StudentClasses = () => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
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
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">My Classes</h1>
        <ul className="space-y-4">
          <li className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">📖 CS101 - Intro to Computer Science</h2>
              <p className="text-gray-600">Prof. Smith | MWF 9:00 AM | Room 101</p>
            </div>
            <span className="text-xl">➡️</span>
          </li>
          <li className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">📊 MATH201 - Advanced Calculus</h2>
              <p className="text-gray-600">Prof. Johnson | TTH 11:00 AM | Room 203</p>
            </div>
            <span className="text-xl">➡️</span>
          </li>
          <li className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">📝 ENG102 - Academic Writing</h2>
              <p className="text-gray-600">Prof. Williams | MWF 2:00 PM | Room 305</p>
            </div>
            <span className="text-xl">➡️</span>
          </li>
        </ul>
      </main>
    </div>
  );
};

export default StudentClasses;
