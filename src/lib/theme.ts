import { useEffect, useState } from "react";
import type { FuelType } from "../types";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "carlog:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Accent palette per fuel type (defined in index.css); hybrids get the "electric" blues. */
export const FUEL_ACCENT: Record<FuelType, string> = {
  hibrit: "hibrit",
  benzin: "benzin",
  dizel: "dizel",
  lpg: "lpg",
  "benzin-lpg": "lpg",
};

export function getThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage blocked (private mode etc.): fall back to the system setting.
  }
  return "system";
}

/** Same logic as the inline script in index.html, which runs before first paint. */
export function applyThemeMode(mode: ThemeMode): void {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#020617" : "#f8fafc");
}

/** The user's Açık/Koyu/Sistem choice, remembered on this device. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(getThemeMode);

  useEffect(() => {
    applyThemeMode(mode);
    if (mode !== "system") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => applyThemeMode("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  function setMode(next: ThemeMode) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; still applies for this visit.
    }
    setModeState(next);
  }

  return [mode, setMode];
}

/** Whether dark mode is currently on, following the class on <html> (for SVG charts). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** Tints the whole page (header included) with a vehicle's accent while it's shown. */
export function usePageAccent(accent: string | null): void {
  useEffect(() => {
    const root = document.documentElement;
    if (accent) root.dataset.accent = accent;
    else delete root.dataset.accent;
    return () => {
      delete root.dataset.accent;
    };
  }, [accent]);
}
