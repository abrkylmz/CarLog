import { useEffect, useState } from "react";

/**
 * Series colors for fuel vs. other expenses, stepped separately for light and dark
 * surfaces. Both pairs pass the colorblind-separation and contrast checks.
 */
export const SERIES_COLORS = {
  fuel: { light: "#2a78d6", dark: "#3987e5" },
  other: { light: "#eb6834", dark: "#d95926" },
} as const;

/** Tailwind classes for the same colors on HTML marks (legend swatches, bars). */
export const SERIES_BG = {
  fuel: "bg-[#2a78d6] dark:bg-[#3987e5]",
  other: "bg-[#eb6834] dark:bg-[#d95926]",
} as const;

/** Recharts takes literal colors, so SVG charts need to know the active scheme. */
export function usePrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setDark(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return dark;
}
