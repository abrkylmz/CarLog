/** @type {import('tailwindcss').Config} */
const brandShade = (shade) => `rgb(var(--brand-${shade}) / <alpha-value>)`;

export default {
  // Dark mode follows the "dark" class on <html>, set from the user's Açık/Koyu/Sistem choice.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Adds `scale` so the press effect (index.css) also animates on elements with `transition`.
      transitionProperty: {
        DEFAULT:
          "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, scale",
      },
      colors: {
        // Accent color, re-tinted per vehicle fuel type via CSS variables (see index.css).
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, brandShade(s)])),
      },
    },
  },
  plugins: [],
};
