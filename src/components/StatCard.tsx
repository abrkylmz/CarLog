import { useCountUp } from "../lib/motion";

interface Props {
  label: string;
  value: string;
  hint?: string;
  /** When given, the figure counts up to `to` (formatted with `format`) instead of showing `value`. */
  count?: { to: number; format: (n: number) => string };
}

export default function StatCard({ label, value, hint, count }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {count ? <CountUp to={count.to} format={count.format} /> : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** A number that ticks up to its value (see useCountUp). */
export function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  return <>{format(useCountUp(to))}</>;
}
