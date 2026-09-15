/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./src/components/ui/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          500: "#7C3AED",
          600: "#6D28D9",
          700: "#5B21B6",
        }
      }
    }
  },
  plugins: [],
}
