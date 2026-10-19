import { CATEGORY_BG } from "../lib/chartColors";
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
    <ul className="card flex flex-col gap-2.5 p-4">
      {rows.map(({ category, total }, i) => (
        <li key={category} className="text-sm" title={`${EXPENSE_CATEGORY_LABELS[category]}: ${formatTL(total)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-sm ${CATEGORY_BG[category]}`} />
              {EXPENSE_CATEGORY_LABELS[category]}
            </span>
            <span className="whitespace-nowrap font-medium">
              {formatTL(total)}
              <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                %{Math.round((total / grandTotal) * 100)}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`grow-x h-2 rounded-full ${CATEGORY_BG[category]}`}
              style={{ width: `${Math.max((total / max) * 100, 2)}%`, animationDelay: `${i * 70}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
