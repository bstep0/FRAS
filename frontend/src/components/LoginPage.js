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
      <div
        className="pointer-events-none absolute inset-0 bg-unt-mesh opacity-90 dark:opacity-70"
        aria-hidden
      />
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-2xl backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/70">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Left side gradient panel */}
            <div className="relative hidden h-full rounded-3xl bg-unt-gradient p-10 text-white lg:col-span-3 lg:flex lg:flex-col lg:justify-center">
              <div>
                <p className="text-md uppercase tracking-[0.4em] text-white/70">
                  University of North Texas
                </p>
                <h1 className="mt-6 text-5xl font-semibold leading-tight">
                  Facial Recognition Attendance System
                </h1>
              </div>
            </div>

            {/* Right side login form */}
            <div className="col-span-5 bg-white/95 px-6 py-10 sm:px-10 lg:col-span-2 dark:bg-slate-950/80">
              <div className="mb-8 flex items-center gap-3">
                <img
                  src="/UNT_logo.png"
                  alt="University of North Texas"
                  className="h-12 w-auto"
                />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Welcome!
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Sign in with your UNT credentials to continue.
              </p>
              {error ? (
                <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </p>
              ) : null}
              <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-unt-green focus:outline-none focus:ring-2 focus:ring-unt-green/30 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-white"
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
