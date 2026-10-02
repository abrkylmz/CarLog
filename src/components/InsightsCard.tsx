import { AlertTriangle, Info, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { Insight } from "../lib/insights";

const ROW: Record<Insight["tone"], string> = {
  good: "bg-emerald-50/70 dark:bg-emerald-950/30",
  warn: "bg-amber-50/80 dark:bg-amber-950/30",
  info: "bg-slate-50 dark:bg-slate-800/50",
};
const ICON: Record<Insight["tone"], string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-brand-600 dark:text-brand-300",
};

/** "Öne çıkanlar": short personal observations at the top of a vehicle's summary. */
export default function InsightsCard({ insights, className = "" }: { insights: Insight[]; className?: string }) {
  if (insights.length === 0) return null;
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles size={18} className="text-brand-500" />
        Öne Çıkanlar
      </h3>
      <ul className="flex flex-col gap-2">
        {insights.map((insight, i) => {
          const Icon =
            insight.trend === "up" ? TrendingUp : insight.trend === "down" ? TrendingDown : insight.tone === "warn" ? AlertTriangle : Info;
          return (
            <li
              key={insight.kind}
              className={`rise flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm ${ROW[insight.tone]}`}
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <Icon size={17} className={`mt-px shrink-0 ${ICON[insight.tone]}`} />
              <span className="leading-snug">{insight.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
