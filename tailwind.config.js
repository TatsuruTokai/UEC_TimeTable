/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "sans-serif",
        ],
      },
      colors: {
        uec: {
          50: "#edf7ff",
          100: "#d6eeff",
          500: "#0d7edb",
          600: "#096abf",
          700: "#0b4a8b",
          800: "#083f76",
          900: "#082b4f",
          950: "#03172b",
        },
      },
    },
  },
  plugins: [],
};
