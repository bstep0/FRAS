// This part of the student pages is incomplete and will be completed during capstone II since it is not a core functionality of the system

import React from "react";
import { Link } from "react-router-dom";

const StudentMessages = () => {
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
            <li className="mb-4">
              <Link to="/student/messages" className="flex items-center p-2 hover:bg-gray-200 rounded">
                💬 Messages
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Message List */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        <ul className="space-y-4">
          {["Smith", "Johnson", "Williams", "Davis", "Garcia"].map((prof, index) => (
            <li key={index} className="bg-white p-4 rounded-lg shadow flex items-center">
              <img src={`https://i.pravatar.cc/40?u=${index}`} alt="Avatar" className="rounded-full w-10 h-10 mr-4" />
              <div>
                <h2 className="text-lg font-semibold">Prof. {prof}</h2>
                <p className="text-gray-600">Sent a message recently</p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default StudentMessages;
