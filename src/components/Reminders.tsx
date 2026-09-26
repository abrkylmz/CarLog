import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Pencil, Repeat, Trash2, UserRound } from "lucide-react";
import { errorMessage } from "../lib/api";
import { formatDate, formatNumber, REMINDER_KIND_LABELS } from "../lib/format";
import { reminderStatus, type ReminderLevel, type ReminderStatus } from "../lib/reminders";
import type { Reminder, ReminderInput, ReminderKind } from "../types";
import { CancelButton } from "./EntryForm";

/** Typical schedules in Turkey, pre-filled when a kind is picked for a new reminder. */
const DEFAULT_REPEAT: Record<ReminderKind, { months?: number; km?: number }> = {
  muayene: { months: 24 },
  egzoz: { months: 24 },
  sigorta: { months: 12 },
  kasko: { months: 12 },
  vergi: { months: 6 },
  bakim: { km: 10000 },
  lastik: {},
  diger: {},
};

const REPEAT_MONTH_OPTIONS = [3, 6, 12, 24];

export function reminderTitle(r: Pick<Reminder, "kind" | "title">): string {
  return r.title || REMINDER_KIND_LABELS[r.kind];
}

function repeatText(r: Pick<Reminder, "repeatMonths" | "repeatKm">): string | null {
  const parts: string[] = [];
  if (r.repeatMonths) parts.push(r.repeatMonths % 12 === 0 ? `${r.repeatMonths / 12} yılda` : `${r.repeatMonths} ayda`);
  if (r.repeatKm) parts.push(`${formatNumber(r.repeatKm, 0)} km'de`);
  return parts.length ? `Her ${parts.join(" veya ")} bir` : null;
}

function dueText(r: Pick<Reminder, "dueDate" | "dueKm">): string {
  return [r.dueDate ? formatDate(r.dueDate) : null, r.dueKm != null ? `${formatNumber(r.dueKm, 0)} km` : null]
    .filter(Boolean)
    .join(" · ");
}

// ---- Status badge ------------------------------------------------------------

const LEVEL_STYLES: Record<ReminderLevel, { className: string; icon: React.ReactNode; label: string }> = {
  overdue: {
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: <AlertTriangle size={12} />,
    label: "Gecikti",
  },
  soon: {
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    icon: <Clock size={12} />,
    label: "Yaklaşıyor",
  },
  planned: {
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: <CalendarClock size={12} />,
    label: "Planlandı",
  },
  done: {
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: <CheckCircle2 size={12} />,
    label: "Tamamlandı",
  },
};

/** Icon + words, never color alone. */
export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const style = LEVEL_STYLES[status.level];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.icon}
      {status.level === "planned" || status.level === "done" ? status.text || style.label : status.text}
    </span>
  );
}

// ---- Form ----------------------------------------------------------------------

interface FormProps {
  vehicleId: string;
  latestKm: number | null;
  onSubmit: (input: ReminderInput) => Promise<void>;
  initial?: Reminder;
  submitLabel?: string;
  onCancel?: () => void;
}

export function ReminderForm({ vehicleId, latestKm, onSubmit, initial, submitLabel = "Hatırlatma Ekle", onCancel }: FormProps) {
  const [kind, setKind] = useState<ReminderKind>(initial?.kind ?? "muayene");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [dueKm, setDueKm] = useState(initial?.dueKm != null ? String(initial.dueKm) : "");
  const [repeatMonths, setRepeatMonths] = useState(
    initial ? String(initial.repeatMonths ?? "") : String(DEFAULT_REPEAT.muayene.months ?? ""),
  );
  const [repeatKm, setRepeatKm] = useState(initial?.repeatKm != null ? String(initial.repeatKm) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const monthOptions = [...new Set([...REPEAT_MONTH_OPTIONS, ...(initial?.repeatMonths ? [initial.repeatMonths] : [])])].sort(
    (a, b) => a - b,
  );

  function changeKind(next: ReminderKind) {
    setKind(next);
    if (!initial) {
      setRepeatMonths(String(DEFAULT_REPEAT[next].months ?? ""));
      setRepeatKm(String(DEFAULT_REPEAT[next].km ?? ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const km = dueKm.trim() ? Number(dueKm.replace(",", ".")) : undefined;
    const everyKm = repeatKm.trim() ? Number(repeatKm.replace(",", ".")) : undefined;
    if (!dueDate && km == null) return setError("Bir tarih veya kilometre girin.");
    if ((km != null && !(km > 0)) || (everyKm != null && !(everyKm > 0))) return setError("Geçerli bir kilometre girin.");

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        vehicleId,
        kind,
        title: title.trim() || undefined,
        dueDate: dueDate || undefined,
        dueKm: km,
        repeatMonths: repeatMonths ? Number(repeatMonths) : undefined,
        repeatKm: everyKm,
        note: note.trim() || undefined,
      });
      if (!initial) {
        setTitle("");
        setDueDate("");
        setDueKm("");
        setNote("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
    >
      <Field label="Tür">
        <select value={kind} onChange={(e) => changeKind(e.target.value as ReminderKind)} className="input">
          {Object.entries(REMINDER_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Başlık (opsiyonel)">
        <input
          type="text"
          placeholder={REMINDER_KIND_LABELS[kind]}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Son Tarih">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
      </Field>

      <Field label="veya Kilometre" hint={latestKm != null ? `Şu an: ${formatNumber(latestKm, 0)} km` : undefined}>
        <input
          type="number"
          inputMode="numeric"
          step="any"
          placeholder={latestKm != null ? String(Math.ceil((latestKm + 10000) / 1000) * 1000) : "110000"}
          value={dueKm}
          onChange={(e) => setDueKm(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Tekrar">
        <select value={repeatMonths} onChange={(e) => setRepeatMonths(e.target.value)} className="input">
          <option value="">Tarihe göre tekrarlanmasın</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m % 12 === 0 ? `Her ${m / 12} yılda bir` : `Her ${m} ayda bir`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Her ... km'de bir (opsiyonel)">
        <input
          type="number"
          inputMode="numeric"
          step="any"
          placeholder="10000"
          value={repeatKm}
          onChange={(e) => setRepeatKm(e.target.value)}
          className="input"
        />
      </Field>

      <div className="col-span-full">
        <Field label="Not (opsiyonel)">
          <input
            type="text"
            placeholder="Randevu, servis adı…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="col-span-full flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
        <div className="flex gap-2">
          {onCancel ? <CancelButton onClick={onCancel} /> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Kaydediliyor…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span> : null}
    </label>
  );
}

// ---- List ----------------------------------------------------------------------

interface ListProps {
  reminders: Reminder[];
  latestKm: number | null;
  onComplete: (reminder: Reminder) => void;
  onEdit?: (reminder: Reminder) => void;
  canEdit?: (reminder: Reminder) => boolean;
  onDelete?: (reminder: Reminder) => void;
}

const LEVEL_ORDER: Record<ReminderLevel, number> = { overdue: 0, soon: 1, planned: 2, done: 3 };

export function ReminderList({ reminders, latestKm, onComplete, onEdit, canEdit, onDelete }: ListProps) {
  const active = reminders
    .filter((r) => !r.doneAt)
    .map((r) => ({ reminder: r, status: reminderStatus(r, latestKm) }))
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.status.level] - LEVEL_ORDER[b.status.level] ||
        (a.reminder.dueDate ?? "9999").localeCompare(b.reminder.dueDate ?? "9999") ||
        (a.reminder.dueKm ?? Infinity) - (b.reminder.dueKm ?? Infinity),
    );
  const done = reminders.filter((r) => r.doneAt).sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1));

  return (
    <>
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Bekleyen hatırlatma yok. Yukarıdan muayene, sigorta, bakım gibi tarihleri ekleyin.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {active.map(({ reminder: r, status }) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{reminderTitle(r)}</p>
                  <ReminderStatusBadge status={status} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{dueText(r)}</span>
                  {repeatText(r) ? (
                    <span className="inline-flex items-center gap-1">
                      <Repeat size={11} />
                      {repeatText(r)}
                    </span>
                  ) : null}
                  {r.note ? <span className="truncate">· {r.note}</span> : null}
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <UserRound size={11} />
                    {r.createdBy ?? "silinmiş kullanıcı"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onComplete(r)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                >
                  <CheckCircle2 size={14} />
                  Tamamlandı
                </button>
                {onEdit && (canEdit?.(r) ?? true) ? (
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    aria-label="Hatırlatmayı düzenle"
                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Pencil size={16} />
                  </button>
                ) : onEdit ? (
                  // Keeps the buttons aligned on rows this user can't edit.
                  <span className="w-6" aria-hidden />
                ) : null}
                {onDelete && (canEdit?.(r) ?? true) ? (
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    aria-label="Hatırlatmayı sil"
                    className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer px-4 py-2.5 font-medium text-slate-600 dark:text-slate-300">
            Tamamlananlar ({done.length})
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {done.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-slate-600 dark:text-slate-300">{reminderTitle(r)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Hedef: {dueText(r)}</p>
                </div>
                <span className="text-right text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(r.doneAt!.slice(0, 10))}
                  <br />
                  {r.doneBy ?? "silinmiş kullanıcı"}
                </span>
                {onDelete && (canEdit?.(r) ?? true) ? (
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    aria-label="Hatırlatmayı sil"
                    className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** What the next reminder will look like once this one is completed, for the confirmation text. */
export function nextReminderPreview(r: Reminder, latestKm: number | null): string | null {
  const parts: string[] = [];
  if (r.repeatMonths) parts.push(formatDate(addMonths(r.dueDate ?? new Date().toISOString().slice(0, 10), r.repeatMonths)));
  if (r.repeatKm) parts.push(`${formatNumber((r.dueKm ?? latestKm ?? 0) + r.repeatKm, 0)} km`);
  return parts.length ? parts.join(" · ") : null;
}

/** Same rule as the server: clamp to the month's last day. */
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
