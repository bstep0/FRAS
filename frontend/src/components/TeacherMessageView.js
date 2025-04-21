// The teacher's individual message/chat view page is currently hardcoded and incomplete, but shows what the page will look like
// It will be completed in capstone II

import React from "react";
import { Link, useParams } from "react-router-dom";

const TeacherMessageView = () => {
  const { studentName } = useParams();

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
        <h1 className="text-3xl font-bold mb-6">Chat with {studentName}</h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          {/* Messages */}
          <ul className="space-y-4">
            <li className="bg-gray-200 p-4 rounded-lg w-3/4">Hello, I need help with my attendance.</li>
            <li className="bg-blue-500 text-white p-4 rounded-lg w-3/4 ml-auto">Test message to show chat.</li>
          </ul>
        </div>

        {/* Text Box for Input*/}
        <input
          type="text"
          placeholder="Type a message..."
          className="w-full p-2 border rounded mb-4"
        />
        <button className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
          Send
        </button>
      </main>
    </div>
  );
};

export default TeacherMessageView;
