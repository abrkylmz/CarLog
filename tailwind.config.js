/** @type {import('tailwindcss').Config} */
import defaultColors from "tailwindcss/colors";

const brandShade = (shade) => `rgb(var(--brand-${shade}) / <alpha-value>)`;

export default {
  // Dark mode follows the "dark" class on <html>, set from the user's Açık/Koyu/Sistem choice.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"Plus Jakarta Sans Variable\"", "ui-sans-serif", "system-ui", "-apple-system", "\"Segoe UI\"", "sans-serif"],
      },
      // Adds `scale` so the press effect (index.css) also animates on elements with `transition`.
      transitionProperty: {
        DEFAULT:
          "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, scale",
      },
      colors: {
        // Accent color, re-tinted per vehicle fuel type via CSS variables (see index.css).
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, brandShade(s)])),
        // The two grays used for secondary text are set per theme (index.css) so small text keeps
        // 4.5:1 contrast on its background in both themes; the other shades stay Tailwind's.
        slate: { ...defaultColors.slate, 400: "rgb(var(--slate-400) / <alpha-value>)", 500: "rgb(var(--slate-500) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
};
