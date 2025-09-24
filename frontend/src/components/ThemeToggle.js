import React from "react";
import { useTheme } from "../context/ThemeContext";

const IconSun = ({ className = "" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const IconMoon = ({ className = "" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 12 17a7 7 0 0 0 9-4.21Z" />
  </svg>
);

const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group inline-flex items-center gap-2 rounded-full border border-unt-green/40 bg-white/70 px-2 py-1 text-sm font-medium text-unt-green shadow-sm transition hover:border-unt-green hover:text-unt-greenDark dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-200 ${className}`}
      aria-pressed={isDark}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-unt-green/10 text-unt-green transition group-hover:bg-unt-green/15 dark:bg-white/10 dark:text-white">
        {isDark ? <IconMoon className="h-4 w-4" /> : <IconSun className="h-4 w-4" />}
      </span>
      <span className="pr-2">{isDark ? "Light" : "Dark"} mode</span>
      <span className="sr-only">Toggle between light and dark mode</span>
    </button>
  );
};

export default ThemeToggle;

