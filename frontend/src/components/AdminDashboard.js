import React from "react";
import { Link } from "react-router-dom";

// This page contains the very basic code for the admin dashboard. It contains a sidebar with a link to the user management page. The sidebar is styled using Tailwind CSS classes
// The main content area is currently empty and will be completed in capstone II

const AdminDashboard = () => {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-6">
      <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-6">Attendance System</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/admin/users" className="block p-2 hover:bg-gray-700 rounded">User Management</Link>
            </li>
          </ul>
        </nav>
      </aside>
      
      <main className="flex-1 p-6 bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-3 gap-6">
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
