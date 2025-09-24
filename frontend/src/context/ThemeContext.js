import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext();

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedPreference = window.localStorage.getItem("facial-recognition-theme");
  if (storedPreference === "light" || storedPreference === "dark") {
    return storedPreference;
  }

  const prefersDark = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  if (prefersDark?.matches) {
    return "dark";
  }

  return "light";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (!root) return undefined;

    const handlePreferenceChange = (event) => {
      setTheme(event.matches ? "dark" : "light");
    };

    const mediaQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    mediaQuery?.addEventListener?.("change", handlePreferenceChange);
    mediaQuery?.addListener?.(handlePreferenceChange);

    return () => {
      mediaQuery?.removeEventListener?.("change", handlePreferenceChange);
      mediaQuery?.removeListener?.(handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle("dark", theme === "dark");
    document.body.dataset.theme = theme;
    window.localStorage.setItem("facial-recognition-theme", theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

