/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "media",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#b8dcff",
          300: "#8ac6ff",
          400: "#57a8ff",
          500: "#2f87f5",
          600: "#1f68d1",
          700: "#1c53a8",
          800: "#1b4685",
          900: "#1a3c6d",
        },
      },
    },
  },
  plugins: [],
};
