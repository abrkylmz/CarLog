import { SERIES_BG } from "../lib/chartColors";
import { totalsByCategory } from "../lib/calc";
import { EXPENSE_CATEGORY_LABELS, formatTL } from "../lib/format";
import type { Expense } from "../types";

/** Share of each expense category, as labeled horizontal bars. */
export default function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const rows = totalsByCategory(expenses);
  const grandTotal = rows.reduce((t, r) => t + r.total, 0);
  if (rows.length === 0 || grandTotal <= 0) return null;
  const max = rows[0].total;

  return (
    <ul className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {rows.map(({ category, total }) => (
        <li key={category} className="text-sm" title={`${EXPENSE_CATEGORY_LABELS[category]}: ${formatTL(total)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-300">{EXPENSE_CATEGORY_LABELS[category]}</span>
            <span className="whitespace-nowrap font-medium">
              {formatTL(total)}
              <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                %{Math.round((total / grandTotal) * 100)}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-2 rounded-full ${SERIES_BG.other}`}
              style={{ width: `${Math.max((total / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
