/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        unt: {
          green: "#00853D",
          greenDark: "#006A31",
          accent: "#00A550",
          forest: "#004225",
        },
        surface: {
          light: "#F1F5F4",
          dark: "#0B1324",
        },
      },
      boxShadow: {
        brand: "0 20px 45px -15px rgba(0, 133, 61, 0.45)",
      },
      backgroundImage: {
        "unt-gradient": "linear-gradient(135deg, #00853D 0%, #00A550 100%)",
        "unt-mesh":
          "radial-gradient(circle at 0% 0%, rgba(0,133,61,0.2), transparent 55%), radial-gradient(circle at 100% 0%, rgba(0,165,80,0.18), transparent 55%), radial-gradient(circle at 50% 100%, rgba(0,106,49,0.25), transparent 50%)",
      },
      fontFamily: {
        display: ["'Segoe UI'", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "'Segoe UI'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
