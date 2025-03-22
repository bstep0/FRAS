import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const ClassAttendanceChart = () => {
  const data = {
    labels: ["Present", "Absent", "Late"],
    datasets: [
      {
        data: [87, 10, 3], // Adjust data dynamically if needed
        backgroundColor: ["#4CAF50", "#F44336", "#FFC107"],
        borderWidth: 2,
        hoverOffset: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: {
            size: 14,
          },
          color: "#333",
        },
      },
    },
  };

  return (
    <div className="flex justify-center items-center w-full">
      <div className="bg-white p-6 rounded-lg shadow-md w-80">
        <div className="h-64">
          <Pie data={data} options={options} />
        </div>
      </div>
    </div>
  );
};

export default ClassAttendanceChart;
