// This is currently unused is not being used by the system
// It's implementation is being considered for capstone II

import React from "react";
import { Link } from "react-router-dom";

const AttendanceTracking = () => {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6 min-h-screen">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/admin" className="block p-2 hover:bg-gray-700 rounded">Dashboard</Link>
            </li>
            <li className="mb-4">
              <Link to="/admin/users" className="block p-2 hover:bg-gray-700 rounded">User Management</Link>
            </li>
            <li className="mb-4">
              <Link to="/admin/reports" className="block p-2 hover:bg-gray-700 rounded">Reports</Link>
            </li>
          </ul>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Attendance Tracking</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Class Attendance</h2>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2">Student Name</th>
                <th className="border border-gray-300 p-2">Date</th>
                <th className="border border-gray-300 p-2">Status</th>
                <th className="border border-gray-300 p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">John Doe</td>
                <td className="border border-gray-300 p-2">March 14, 2025</td>
                <td className="border border-gray-300 p-2 text-green-600">Present</td>
                <td className="border border-gray-300 p-2">
                  <button className="bg-yellow-500 text-white px-4 py-1 rounded">Edit</button>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Jane Smith</td>
                <td className="border border-gray-300 p-2">March 14, 2025</td>
                <td className="border border-gray-300 p-2 text-red-600">Absent</td>
                <td className="border border-gray-300 p-2">
                  <button className="bg-yellow-500 text-white px-4 py-1 rounded">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AttendanceTracking;
