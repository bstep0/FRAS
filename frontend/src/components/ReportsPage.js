import React from "react";
import { Link } from "react-router-dom";

const ReportsPage = () => {
  return (
    <div className="flex min-h-screen">
      
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
              <Link to="/admin/attendance" className="block p-2 hover:bg-gray-700 rounded">Attendance</Link>
            </li>
          </ul>
        </nav>
      </aside>
      
    
      <main className="flex-1 p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Attendance Reports</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Generate Reports</h2>
          <div className="mb-4">
            <label className="block mb-2 font-semibold">Select Class</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option>Class 1</option>
              <option>Class 2</option>
              <option>Class 3</option>
            </select>
          </div>
          <button className="bg-blue-500 text-white px-4 py-2 rounded">Generate Report</button>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
