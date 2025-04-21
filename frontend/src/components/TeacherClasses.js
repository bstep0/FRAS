// The teacher's class page is currently hardcoded and incomplete, but what the page will look like
// It will be completed in capstone II

import React from "react";
import { Link } from "react-router-dom";

const TeacherClasses = () => {
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">My Classes</h1>

        {/* Class List */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-2xl font-semibold mb-4">All Classes</h2>
        <ul className="space-y-4">
          {[
            { name: "CSCE 4905", students: 28 },
            { name: "CSCE 3055", students: 17 },
            { name: "CSCE 1040", students: 47 },
          ].map((classItem, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow">
              <div>
                <h3 className="text-lg font-semibold">{classItem.name}</h3>
                <p className="text-gray-600">{classItem.students} Students Enrolled</p>
              </div>
              {/* Buttons Section */}
              <div className="flex space-x-2">
              <Link to={`/teacher/classes/${classItem.name}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                View
              </Link>
              </div>
            </li>
          ))}
        </ul>
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

export default TeacherClasses;
