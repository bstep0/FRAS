import React from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";

const AdminDashboard = () => {
  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-1 gap-6">
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              to="/admin/users"
              className="group flex h-full flex-col justify-between rounded-2xl border border-unt-green/20 bg-white/60 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-unt-green/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-unt-green dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-unt-green dark:text-white">
                    User Management
                  </h3>
                  <p className="mt-6 text-md text-slate-600 dark:text-slate-300">
                    Create users, assign roles, and manage users across the platform.
                  </p>
                </div>
                <span
                  className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-unt-green/10 text-unt-green group-hover:bg-unt-green/15"
                  aria-hidden
                >
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
              </div>
            </Link>

            <Link
              to="/admin/classes"
              className="group flex h-full flex-col justify-between rounded-2xl border border-unt-green/20 bg-white/60 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-unt-green/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-unt-green dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-unt-green dark:text-white">
                    Class Management
                  </h3>
                  <p className="mt-6 text-md text-slate-600 dark:text-slate-300">
                    Create classes, adjust schedules, and keep rosters synced with instructor assignments.
                  </p>
                </div>
                <span
                  className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-unt-green/10 text-unt-green group-hover:bg-unt-green/15"
                  aria-hidden
                >
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                    <path d="M13 3v5h5" />
                    <path d="M8 13h6" />
                    <path d="M8 17h6" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
