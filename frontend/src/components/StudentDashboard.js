import React from "react";
import { Link } from "react-router-dom";

const StudentDashboard = () => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r min-h-screen">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
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
        <div className="absolute bottom-6 left-6 flex items-center space-x-2">
          <span className="text-gray-600">John Smith</span>
          <span className="text-sm text-gray-500">Student</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        
        {/* Attendance History Card */}
        <div className="bg-gray-200 p-6 rounded-lg mb-6">
          <h2 className="text-xl text-black font-semibold">Attendance History</h2>
          <p className="text-black">Check your attendance records</p>
          <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">View History</button>
        </div>

        {/* Classes */}
        <h2 className="text-2xl font-semibold mb-4">My Classes</h2>
        <table className="w-full bg-white shadow rounded-lg">
          <tbody>
            <tr className="border-b">
              <td className="p-4">CSCE 4905</td>
              <td>Prof. Rabah</td>
              <td>12:30 PM</td>
              <td>Room 442</td>
            </tr>
            <tr className="border-b">
              <td className="p-4">CSCE 1040</td>
              <td>Prof. Keathly</td>
              <td>11:00 AM</td>
              <td>Room 203</td>
            </tr>
            <tr>
              <td className="p-4">CSCE 3600</td>
              <td>Prof. Smith</td>
              <td>2:00 PM</td>
              <td>Room 305</td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default StudentDashboard;
