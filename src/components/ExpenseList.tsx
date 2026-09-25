import { Pencil, Trash2, UserRound } from "lucide-react";
import { monthKey } from "../lib/calc";
import { EXPENSE_CATEGORY_LABELS, formatDate, formatMonth, formatTL } from "../lib/format";
import type { Expense } from "../types";

interface Props {
  expenses: Expense[];
  /** Omitted for users without delete permission; the delete buttons are hidden then. */
  onDelete?: (id: string) => void;
  /** Shown only on rows canEdit allows (the author's own rows, or all rows for admins). */
  onEdit?: (expense: Expense) => void;
  canEdit?: (expense: Expense) => boolean;
}

/** Expenses grouped by month (newest first), each month with its subtotal. */
export default function ExpenseList({ expenses, onDelete, onEdit, canEdit }: Props) {
  if (expenses.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Bu araç için henüz masraf yok. Yukarıdan bakım, sigorta, otopark gibi masrafları ekleyin.
      </p>
    );
  }

  const byMonth = new Map<string, Expense[]>();
  for (const e of [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const key = monthKey(e.date);
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {[...byMonth].map(([month, items]) => (
        <section key={month} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
          <header className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm dark:bg-slate-800/50">
            <h4 className="font-semibold capitalize">{formatMonth(month)}</h4>
            <span className="font-semibold">{formatTL(items.reduce((t, e) => t + e.amount, 0))}</span>
          </header>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{EXPENSE_CATEGORY_LABELS[expense.category]}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatDate(expense.date)}</span>
                    {expense.note ? <span className="truncate">· {expense.note}</span> : null}
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"
                      title="Masrafı ekleyen"
                    >
                      <UserRound size={11} />
                      {expense.createdBy ?? "silinmiş kullanıcı"}
                      {expense.updatedAt ? (
                        <span title={`${expense.updatedBy ?? "silinmiş kullanıcı"} düzenledi`}>· düzenlendi</span>
                      ) : null}
                    </span>
                  </p>
                </div>
                <span className="whitespace-nowrap font-medium">{formatTL(expense.amount)}</span>
                {onEdit && (canEdit?.(expense) ?? true) ? (
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    aria-label="Masrafı düzenle"
                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Pencil size={16} />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(expense.id)}
                    aria-label="Masrafı sil"
                    className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
