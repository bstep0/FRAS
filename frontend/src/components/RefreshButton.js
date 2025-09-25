import React from "react";

const RefreshIcon = ({ className = "" }) => (
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
    <path d="M21 10a9 9 0 1 0-6.219 8.56" />
    <polyline points="21 6 21 10 17 10" />
  </svg>
);

const RefreshButton = ({ className = "" }) => {
  const handleRefresh = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      className={`group inline-flex items-center gap-2 rounded-full border border-unt-green/40 bg-white/70 px-3 py-1.5 text-sm font-medium text-unt-green shadow-sm transition hover:border-unt-green hover:text-unt-greenDark dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-200 ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-unt-green/10 text-unt-green transition group-hover:bg-unt-green/15 dark:bg-white/10 dark:text-white">
        <RefreshIcon className="h-4 w-4" />
      </span>
      <span className="pr-2">Refresh</span>
      <span className="sr-only">Reload the current page</span>
    </button>
  );
};

export default RefreshButton;
