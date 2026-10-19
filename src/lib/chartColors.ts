import type { ExpenseCategory } from "../types";

/**
 * One color system for every chart: fuel is always the brand color (it follows the chosen accent),
 * other expenses are always warm, and each expense kind keeps its own hue wherever it appears.
 * Classes, not literal colors, so SVG marks and HTML swatches stay identical in both themes.
 */
export const SERIES = {
  fuel: {
    /** Bars and segments drawn at full strength. */
    fill: "fill-brand-500 dark:fill-brand-400",
    /** The rest of the bars when one is emphasised. */
    soft: "fill-brand-200 dark:fill-brand-800",
    bg: "bg-brand-500 dark:bg-brand-400",
  },
  other: {
    fill: "fill-orange-500 dark:fill-orange-400",
    soft: "fill-orange-200 dark:fill-orange-900",
    bg: "bg-orange-500 dark:bg-orange-400",
  },
} as const;

/** Swatch and bar colors for HTML marks, kept for the older call sites. */
export const SERIES_BG = { fuel: SERIES.fuel.bg, other: SERIES.other.bg } as const;

/** Each expense kind's own color; none of them is blue, so fuel never gets confused with one. */
export const CATEGORY_BG: Record<ExpenseCategory, string> = {
  bakim: "bg-orange-500 dark:bg-orange-400",
  lastik: "bg-amber-400",
  sigorta: "bg-violet-500 dark:bg-violet-400",
  vergi: "bg-rose-500 dark:bg-rose-400",
  muayene: "bg-teal-500 dark:bg-teal-400",
  otopark: "bg-lime-500",
  otoyol: "bg-fuchsia-500 dark:bg-fuchsia-400",
  yikama: "bg-yellow-300",
  ceza: "bg-red-700 dark:bg-red-500",
  diger: "bg-slate-400 dark:bg-slate-500",
};

/** Notes on a chart: a price rise is bad news (rose), a big one-off cost is an expense (orange). */
export const NOTE = {
  rise: { fill: "fill-rose-500 dark:fill-rose-400", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500 dark:bg-rose-400" },
  drop: { fill: "fill-emerald-500 dark:fill-emerald-400", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500 dark:bg-emerald-400" },
  expense: { fill: "fill-orange-500 dark:fill-orange-400", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500 dark:bg-orange-400" },
} as const;

/** Grid lines and axis labels, the same in every chart. */
export const AXIS = {
  grid: "text-slate-100 dark:text-white/[0.06]",
  tick: "text-slate-500 dark:text-slate-400",
} as const;

/** Recharts takes literal colors, so SVG charts need to know whether dark mode is on. */
export { useIsDark as usePrefersDark } from "./theme";
