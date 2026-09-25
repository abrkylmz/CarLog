import { Pencil, Trash2, UserRound } from "lucide-react";
import type { DerivedEntry } from "../types";
import { formatDate, formatNumber, formatTL } from "../lib/format";

interface Props {
  entries: DerivedEntry[];
  /** Omitted for users without delete permission; the delete column is hidden then. */
  onDelete?: (id: string) => void;
  /** Shown only on rows canEdit allows (the author's own rows, or all rows for admins). */
  onEdit?: (entry: DerivedEntry) => void;
  canEdit?: (entry: DerivedEntry) => boolean;
}

export default function EntryTable({ entries, onDelete, onEdit, canEdit }: Props) {
  const hasActions = Boolean(onDelete || onEdit);
  const byDateDesc = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (byDateDesc.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Bu araç için henüz kayıt yok. Yukarıdan ilk yakıt alımını ekleyin.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <th className="px-3 py-2 font-medium">Tarih</th>
            <th className="px-3 py-2 font-medium">Km</th>
            <th className="px-3 py-2 font-medium">Litre</th>
            <th className="px-3 py-2 font-medium">TL/L</th>
            <th className="px-3 py-2 font-medium">Tutar</th>
            <th className="px-3 py-2 font-medium">L/100km</th>
            <th className="px-3 py-2 font-medium">Not</th>
            {hasActions ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {byDateDesc.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
            >
              <td className="px-3 py-2 whitespace-nowrap">
                {formatDate(entry.date)}
                <span
                  className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"
                  title="Kaydı ekleyen"
                >
                  <UserRound size={11} />
                  {entry.createdBy ?? "silinmiş kullanıcı"}
                  {entry.updatedAt ? (
                    <span title={`${entry.updatedBy ?? "silinmiş kullanıcı"} düzenledi`}>· düzenlendi</span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{formatNumber(entry.odometerKm, 0)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatNumber(entry.liters)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatNumber(entry.pricePerLiter, 2)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-medium">{formatTL(entry.totalCost)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                {entry.consumptionPer100km != null ? formatNumber(entry.consumptionPer100km) : "—"}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2 text-slate-500 dark:text-slate-400">
                {entry.note ?? ""}
              </td>
              {hasActions ? (
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {onEdit && (canEdit?.(entry) ?? true) ? (
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      aria-label="Kaydı düzenle"
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Pencil size={16} />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      aria-label="Kaydı sil"
                      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
