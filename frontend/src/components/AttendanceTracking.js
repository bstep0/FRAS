// This is currently unused is not being used by the system
// It's implementation is being considered for capstone II

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const AttendanceTracking = () => {
  const defaultDate = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString().split("T")[0];
  }, []);

  const [entries, setEntries] = useState([
    { id: "1", name: "John Doe", date: "2025-03-14", status: "Present" },
    { id: "2", name: "Jane Smith", date: "2025-03-14", status: "Absent" },
  ]);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(defaultDate);
  const [newStatus, setNewStatus] = useState("Present");

  const handleAdd = (event) => {
    event.preventDefault();

    if (!newName.trim()) return;

    const entry = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      date: newDate,
      status: newStatus,
    };

    setEntries((previous) => [...previous, entry]);
    setNewName("");
    setNewDate(defaultDate);
    setNewStatus("Present");
  };

  const handleDelete = (entryId) => {
    const confirmed = window.confirm("Delete this attendance entry?");
    if (!confirmed) return;
    setEntries((previous) => previous.filter((entry) => entry.id !== entryId));
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6 min-h-screen">
        <img src="/logo.png" alt="Face Recognition Attendance" className="w-24 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        <nav>
          <ul>
            <li className="mb-4">
              <Link to="/admin" className="block p-2 hover:bg-gray-700 rounded">
                Dashboard
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/admin/users" className="block p-2 hover:bg-gray-700 rounded">
                User Management
              </Link>
            </li>
            <li className="mb-4">
              <Link to="/admin/reports" className="block p-2 hover:bg-gray-700 rounded">
                Reports
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Attendance Tracking</h1>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Class Attendance</h2>

          <form className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={handleAdd}>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full rounded border border-gray-300 p-2"
                placeholder="Add a student"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="w-full rounded border border-gray-300 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
                className="w-full rounded border border-gray-300 p-2"
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
              >
                Add attendance
              </button>
            </div>
          </form>

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
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="border border-gray-300 p-2">{entry.name}</td>
                  <td className="border border-gray-300 p-2">{entry.date}</td>
                  <td
                    className={`border border-gray-300 p-2 ${
                      entry.status === "Present"
                        ? "text-green-600"
                        : entry.status === "Late"
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {entry.status}
                  </td>
                  <td className="border border-gray-300 p-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="bg-red-600 text-white px-4 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AttendanceTracking;
