import { Play } from "lucide-react";
import { paths } from "../lib/router";

/** Entry point to the year-in-review on the home screen. */
export default function WrappedBanner({ year, inProgress }: { year: number; inProgress: boolean }) {
  return (
    <a
      href={paths.wrapped(year)}
      className="wrapped-banner group relative mb-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-violet-900/20"
    >
      <div aria-hidden className="wrapped-glow pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <span className="relative text-4xl font-black tracking-tighter tabular-nums">{year}</span>
      <span className="relative min-w-0 flex-1">
        <span className="block font-semibold">CarLog Yıl Özetin hazır</span>
        <span className="block text-sm text-white/80">
          {inProgress ? "Bu yıl şimdiye kadar kaç km, kaç litre, ne kadar?" : "Yılın nasıl geçti, birlikte bakalım."}
        </span>
      </span>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-violet-700 shadow-md transition group-hover:scale-105">
        <Play size={18} className="translate-x-px" fill="currentColor" />
      </span>
    </a>
  );
}
