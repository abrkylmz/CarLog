import { Fuel, Target } from "lucide-react";
import { formatTL } from "../lib/format";
import { CountUp } from "./StatCard";

const tl = (n: number) => formatTL(n).replace(",00", "");

interface Props {
  /** Spent so far this month (fuel + other expenses). */
  spent: number;
  /** Percent change against the same days of last month. */
  change: number | null;
  budget: number | null;
  onEditBudget: () => void;
}

/**
 * "Bu Ay Toplam" with the monthly budget: a ring of how much is used, the days left and, from the
 * spending pace so far, where the month is heading. Without a budget, the plain figure and a link
 * to set one.
 */
export default function BudgetStat({ spent, change, budget, onEditBudget }: Props) {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - day;
  // A pace from the first couple of days says little, so the forecast waits until day 3.
  const projected = day >= 3 && spent > 0 ? Math.round((spent / day) * daysInMonth) : null;
  const monthName = now.toLocaleDateString("tr-TR", { month: "long" });

  if (!budget) {
    return (
      <div className="col-span-2 flex items-start gap-3 rounded-2xl border sm:col-span-1 border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <span className="hidden rounded-xl bg-emerald-50 p-3 text-emerald-600 sm:block dark:bg-emerald-950/50 dark:text-emerald-400">
          <Fuel size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">Bu Ay Toplam</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
            <CountUp to={spent} format={tl} />
          </p>
          <button
            type="button"
            onClick={onEditBudget}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            <Target size={13} />
            Aylık bütçe belirle
          </button>
        </div>
      </div>
    );
  }

  const used = spent / budget;
  const over = projected != null && projected > budget;
  const tone = used >= 1 ? "text-red-500" : used >= 0.85 || over ? "text-amber-500" : "text-brand-500";
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="col-span-2 flex items-center gap-3 rounded-2xl border sm:col-span-1 border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onEditBudget}
        aria-label={`${monthName} bütçesinin yüzde ${Math.round(used * 100)}'i harcandı; bütçeyi düzenle`}
        className="relative shrink-0"
      >
        <svg viewBox="0 0 80 80" className="h-[4.5rem] w-[4.5rem] -rotate-90 sm:h-20 sm:w-20" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-slate-800" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.min(1, used))}
            className={`${tone} transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none`}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums">%{Math.round(used * 100)}</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">bütçe</span>
        </span>
      </button>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
          <span className="capitalize">{monthName}</span> bütçesi {tl(budget)}
        </p>
        <p className="mt-0.5 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
          <CountUp to={spent} format={tl} />
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {daysLeft} gün kaldı
          {projected != null ? (
            <>
              {" "}
              · bu hızla{" "}
              <b className={`tabular-nums ${over ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"}`}>{tl(projected)}</b>
            </>
          ) : change != null ? (
            <> · geçen aya göre %{change}</>
          ) : null}
        </p>
      </div>
    </div>
  );
}
