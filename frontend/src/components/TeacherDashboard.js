// The teacher's dashboard page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React from "react";
import { Link } from "react-router-dom";

const TeacherDashboard = () => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-xl font-semibold mb-6">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/teacher" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📌 Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/teacher/classes" className="flex items-center p-2 hover:bg-gray-200 rounded">
                📚 My Classes
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/teacher/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
        <div className="absolute bottom-6 left-6 flex items-center space-x-2">
          <span className="text-gray-600">Sarah Johnson</span>
          <span className="text-sm text-gray-500">Teacher</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-10">Dashboard</h1>

        {/* My Classes Section */}
        <h2 className="text-2xl font-semibold mb-4">My Classes</h2>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <Link to="/teacher/classes" className="bg-white p-6 rounded-lg shadow hover:bg-gray-200">
            <h2 className="text-lg font-semibold">📚 CSCE 4905</h2>
          </Link>
          <Link to="/teacher/classes" className="bg-white p-6 rounded-lg shadow hover:bg-gray-200">
            <h2 className="text-lg font-semibold">📚 CSCE 3055</h2>
          </Link>
          <Link to="/teacher/classes" className="bg-white p-6 rounded-lg shadow hover:bg-gray-200">
            <h2 className="text-lg font-semibold">📚 CSCE 1040</h2>
          </Link>
        </div>

        {/* Recent Attendance Updates */}
        <h2 className="text-2xl font-semibold mb-4">Recent Attendance Updates</h2>
        <div className="bg-white p-4 shadow rounded-lg">
        <table className="w-full bg-white shadow rounded-lg">
          <tbody>
            <tr className="border-b">
              <td className="p-4"> CSCE 4905</td>
              <td>Alice Johnson</td>
              <td>Present</td>
              <td>(1 hour ago)</td>
            </tr>
            <tr className="border-b">
              <td className="p-4"> CSCE 1040</td>
              <td>Jane Smith</td>
              <td>Absent</td>
              <td>(14 mins ago)</td>
            </tr>
            <tr>
              <td className="p-4"> CSCE 3055</td>
              <td>John Doe</td>
              <td>Late</td>
              <td>(4 mins ago)</td>
            </tr>
          </tbody>
        </table>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
