import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import ThemeToggle from "./ThemeToggle";
import { auth, db } from "../firebaseConfig";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const usersRef = collection(db, "users");
      const roleQuery = query(usersRef, where("email", "==", email));
      const snapshot = await getDocs(roleQuery);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();

        switch (userData.role) {
          case "admin":
            navigate("/admin");
            break;
          case "teacher":
            navigate("/teacher");
            break;
          case "student":
            navigate("/student");
            break;
          default:
            setError("Invalid role assigned to user.");
        }
      } else {
        setError("User not found in the database.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-light text-slate-900 transition-colors duration-300 dark:bg-surface-dark dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-unt-mesh opacity-90 dark:opacity-70" aria-hidden />
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-2xl backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/70">
          <div className="grid gap-0 lg:grid-cols-5">
            <div className="relative hidden h-full rounded-3xl bg-unt-gradient p-10 text-white lg:col-span-3 lg:flex lg:flex-col lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/70">University of North Texas</p>
                <h1 className="mt-6 text-3xl font-semibold leading-tight">Facial Recognition Attendance System</h1>
                <p className="mt-6 max-w-md text-sm text-white/80">
                  Seamlessly manage attendance, keep your courses organized, and stay connected with students across the campus.
                </p>
              </div>
              <div className="mt-12 space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M12 20h9" />
                      <path d="M12 4h9" />
                      <path d="M14 9h7" />
                      <path d="M14 15h7" />
                      <path d="M3 17l3 3 3-3" />
                      <path d="M6 4v16" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Streamlined experience</p>
                    <p className="text-xs text-white/70">Tailored dashboards for students, teachers, and admins.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M22 19a2 2 0 0 1-2 2H4l-2 2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
                      <path d="M14 11h4" />
                      <path d="M14 7h4" />
                      <path d="M14 15h2" />
                      <path d="M7 8h3" />
                      <path d="M7 12h6" />
                      <path d="M7 16h3" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Stay on top of attendance</p>
                    <p className="text-xs text-white/70">Real-time tracking and detailed class insights.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-5 bg-white/95 px-6 py-10 sm:px-10 lg:col-span-2 dark:bg-slate-950/80">
              <div className="mb-8 flex items-center gap-3">
                <img src="/unt-logo.svg" alt="University of North Texas" className="h-12 w-auto" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-unt-green">UNT</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Attendance System</p>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sign in with your UNT credentials to continue.</p>
              {error ? (
                <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </p>
              ) : null}
              <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                    placeholder="your.name@unt.edu"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
                <button type="submit" className="brand-button w-full justify-center">
                  Sign in
                </button>
              </form>
              <p className="mt-8 text-xs text-slate-500 dark:text-slate-400">
                Having trouble? Contact the UNT IT Service Desk at <a href="mailto:helpdesk@unt.edu" className="font-semibold text-unt-green hover:text-unt-greenDark">helpdesk@unt.edu</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
