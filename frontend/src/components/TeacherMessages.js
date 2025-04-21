// The teacher's individual messages page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React from "react";
import { Link } from "react-router-dom";

const TeacherMessages = () => {
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
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        
        {/* Messages List */}
        <ul className="space-y-4">
          {[
            { name: "John Doe", subject: "Attendance Marked Incorrectly", time: "3:42 PM" },
            { name: "Emily Smith", subject: "Absence Notification", time: "Yesterday" },
            { name: "Michael Brown", subject: "I won't be in class today", time: "2 days ago" },
            { name: "Sarah Johnson", subject: "Attedance Question", time: "1 week ago" },
            { name: "David Garcia", subject: "I'll be late to class today", time: "2 weeks ago" },
          ].map((message, index) => (
            <li key={index} className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div className="flex items-center">
                <img
                  src={`https://i.pravatar.cc/40?u=${index}`} 
                  alt="Avatar"
                  className="rounded-full w-10 h-10 mr-4"
                />
                <div>
                  <h2 className="text-lg font-semibold">{message.name}</h2>
                  <p className="text-gray-600">{message.subject} • {message.time}</p>
                </div>
              </div>
              <Link to={`/teacher/messages/${message.name}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              View
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default TeacherMessages;
