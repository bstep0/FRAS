import React from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";

const AdminDashboard = () => {
  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="glass-card">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-unt-green/90">Administration</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Quickly jump into user or class management, or review account details.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/admin/users" className="brand-button">
              Manage Users
            </Link>
            <Link to="/admin/classes" className="brand-button--ghost">
              Manage Classes
            </Link>
          </div>
        </section>

        <section className="glass-card">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tips</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-3 rounded-xl bg-white/50 p-3 shadow-sm dark:bg-slate-800/50">
              <span className="mt-1 h-2 w-2 rounded-full bg-unt-green" aria-hidden />
              Keep user roles up to date to ensure the right experience for admins, instructors, and students.
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-white/50 p-3 shadow-sm dark:bg-slate-800/50">
              <span className="mt-1 h-2 w-2 rounded-full bg-unt-green" aria-hidden />
              Assign instructors to classes so schedules and rosters stay organized across portals.
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-white/50 p-3 shadow-sm dark:bg-slate-800/50">
              <span className="mt-1 h-2 w-2 rounded-full bg-unt-green" aria-hidden />
              Use the refresh buttons in management pages after bulk updates to pull the latest data from Firestore.
            </li>
          </ul>
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
