/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3d63dd",
          600: "#2f4fc4",
          700: "#263f9e",
        },
      },
    },
  },
  plugins: [],
};
