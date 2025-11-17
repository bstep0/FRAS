import React, { useEffect, useMemo, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const ClassAttendanceChart = ({ attendanceSummary }) => {
  const statusEntries = useMemo(
    () =>
      [
        { label: "Present", value: attendanceSummary?.Present ?? 0, color: "#22C55E" },
        { label: "Absent", value: attendanceSummary?.Absent ?? 0, color: "#EF4444" },
        { label: "Late", value: attendanceSummary?.Late ?? 0, color: "#F59E0B" },
      ].filter(({ value }) => value > 0),
    [attendanceSummary]
  );

  const total = useMemo(
    () => statusEntries.reduce((sum, { value }) => sum + value, 0),
    [statusEntries]
  );

  const [isDark, setIsDark] = useState(
    () => supportsDOM && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (!supportsObserver) return undefined;

    const html = document.documentElement;

    const update = () => setIsDark(html.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [supportsObserver]);

  useEffect(() => {
    if (!supportsDOM) return;

    if (isDark) {
      ChartJS.defaults.color = "#FFFFFF";
      ChartJS.defaults.plugins.legend.labels.color = "#FFFFFF";
      ChartJS.defaults.plugins.tooltip.titleColor = "#FFFFFF";
      ChartJS.defaults.plugins.tooltip.bodyColor = "#FFFFFF";
      ChartJS.defaults.plugins.tooltip.backgroundColor = "#0F172A";
      ChartJS.defaults.plugins.tooltip.borderColor = "#334155";
    } else {
      ChartJS.defaults.color = "#1F2937"; // slate-800
      ChartJS.defaults.plugins.legend.labels.color = "#1F2937";
      ChartJS.defaults.plugins.tooltip.titleColor = "#1F2937";
      ChartJS.defaults.plugins.tooltip.bodyColor = "#1F2937";
      ChartJS.defaults.plugins.tooltip.backgroundColor = "#FFFFFF";
      ChartJS.defaults.plugins.tooltip.borderColor = "#CBD5E1";
    }
  }, [isDark, supportsDOM]);

  const data = useMemo(
    () => ({
      labels: statusEntries.map(({ label }) => label),
      datasets: [
        {
          data: statusEntries.map(({ value }) => value),
          backgroundColor: statusEntries.map(({ color }) => color),
          borderWidth: 0.5,
          hoverOffset: 6,
        },
      ],
    }),
    [statusEntries]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: isDark ? "#FFFFFF" : "#1F2937",
            font: { size: 14, weight: "500" },
            usePointStyle: true,
            pointStyle: "circle",
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          titleColor: isDark ? "#FFFFFF" : "#1F2937",
          bodyColor: isDark ? "#FFFFFF" : "#1F2937",
          borderColor: isDark ? "#334155" : "#CBD5E1",
          borderWidth: 1,
        },
      },
    }),
    [isDark]
  );

  return (
    <div className="flex justify-center items-center w-full">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-80">
        {total > 0 ? (
          <div className="h-64">
            {/* key forces re-init when theme flips so colors always update */}
            <Pie key={isDark ? "dark" : "light"} data={data} options={options} />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-center">
            <p className="text-sm text-gray-600 dark:text-slate-100">
              Attendance data will appear here once records are available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassAttendanceChart;
