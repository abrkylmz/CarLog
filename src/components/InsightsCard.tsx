import { Info, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { Insight } from "../lib/insights";

const TONE: Record<Insight["tone"], string> = {
  good: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  warn: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  info: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300",
};

/** "Öne çıkanlar": short personal observations at the top of a vehicle's summary. */
export default function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Sparkles size={14} className="text-brand-500" />
        Öne Çıkanlar
      </h3>
      <ul className="flex flex-col gap-3">
        {insights.map((insight, i) => {
          const Icon = insight.trend === "up" ? TrendingUp : insight.trend === "down" ? TrendingDown : Info;
          return (
            <li key={insight.kind} className="rise flex items-start gap-3 text-sm" style={{ animationDelay: `${120 + i * 70}ms` }}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TONE[insight.tone]}`}>
                <Icon size={15} />
              </span>
              <span className="pt-1 leading-snug">{insight.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
