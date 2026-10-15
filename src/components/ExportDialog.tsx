import { useMemo, useState } from "react";
import { Crown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { buildExport, downloadFile, slug, type ExportContent } from "../lib/export";
import { errorMessage } from "../lib/api";
import { formatDate, formatTL } from "../lib/format";
import { planForFeature, planHasFeature, type PlanId } from "../lib/plans";
import { paths } from "../lib/router";
import { todayIso } from "../lib/reminders";
import type { Expense, FuelEntry, Reminder, Vehicle } from "../types";
import { CancelButton } from "./EntryForm";
import Modal from "./Modal";

interface Props {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
  /** Pre-selected vehicle when opened from a vehicle page. */
  defaultVehicleId?: string;
  /** The user's plan (PDF needs one that includes it) and name (shown on the PDF). */
  plan: PlanId;
  username: string;
  onClose: () => void;
}

type Format = "csv" | "pdf";

type Range = "all" | "this-month" | "last-month" | "this-year" | "last-year" | "custom";

const CONTENT_LABELS: Record<ExportContent, string> = {
  all: "Tüm harcamalar (yakıt + masraf)",
  fuel: "Sadece yakıt dolumları",
  expenses: "Sadece diğer masraflar",
  reminders: "Hatırlatmalar",
};

const CONTENT_TITLES: Record<ExportContent, string> = {
  all: "Harcama Raporu",
  fuel: "Yakıt Raporu",
  expenses: "Masraf Raporu",
  reminders: "Hatırlatmalar",
};

const RANGE_LABELS: Record<Range, string> = {
  all: "Tüm zamanlar",
  "this-month": "Bu ay",
  "last-month": "Geçen ay",
  "this-year": "Bu yıl",
  "last-year": "Geçen yıl",
  custom: "Tarih aralığı seç",
};

function rangeBounds(range: Range, customFrom: string, customTo: string): [string | null, string | null] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthEnd = (year: number, month: number) => `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  switch (range) {
    case "all":
      return [null, null];
    case "this-month":
      return [`${y}-${pad(m)}-01`, monthEnd(y, m)];
    case "last-month": {
      const [ly, lm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return [`${ly}-${pad(lm)}-01`, monthEnd(ly, lm)];
    }
    case "this-year":
      return [`${y}-01-01`, `${y}-12-31`];
    case "last-year":
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "custom":
      return [customFrom || null, customTo || null];
  }
}

export default function ExportDialog({ vehicles, entries, expenses, reminders, defaultVehicleId, plan, username, onClose }: Props) {
  const pdfAllowed = planHasFeature(plan, "pdfReports");
  const [format, setFormat] = useState<Format>("csv");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? "");
  const [content, setContent] = useState<ExportContent>("all");
  const [range, setRange] = useState<Range>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(todayIso());

  const [from, to] = rangeBounds(range, customFrom, customTo);
  const result = useMemo(
    () => buildExport({ vehicles, entries, expenses, reminders }, { content, vehicleId: vehicleId || null, from, to }),
    [vehicles, entries, expenses, reminders, content, vehicleId, from, to],
  );

  async function handleDownload() {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const parts = ["carlog", vehicle ? slug(vehicle.name) : "tum-araclar", content === "all" ? "harcamalar" : content];
    if (content !== "reminders" && from) parts.push(from);
    if (content !== "reminders" && to) parts.push(to);
    if (format === "csv") {
      downloadFile(`${parts.join("_")}.csv`, result.csv);
      onClose();
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const { buildPdf } = await import("../lib/pdf");
      const blob = await buildPdf(result, {
        title: CONTENT_TITLES[content],
        scope: vehicle ? [vehicle.name, vehicle.plate].filter(Boolean).join(" · ") : "Tüm araçlar",
        period:
          content === "reminders"
            ? "Tüm hatırlatmalar"
            : from || to
              ? `${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}`
              : "Tüm zamanlar",
        username,
        reminders: content === "reminders",
      });
      downloadFile(`${parts.join("_")}.pdf`, blob);
      onClose();
    } catch (err) {
      setError(`PDF oluşturulamadı: ${errorMessage(err)}`);
      setWorking(false);
    }
  }

  return (
    <Modal title="Dışa Aktar" onClose={onClose}>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Biçim</span>
          <div role="radiogroup" aria-label="Biçim" className="grid grid-cols-2 gap-2">
            {(
              [
                ["csv", "Excel (CSV)", "Tablo olarak düzenlemek için", FileSpreadsheet],
                ["pdf", "PDF", "Yazdırmak ve paylaşmak için", FileText],
              ] as const
            ).map(([value, label, hint, Icon]) => {
              const locked = value === "pdf" && !pdfAllowed;
              const selected = format === value;
              return locked ? (
                <a
                  key={value}
                  href={paths.plans}
                  onClick={onClose}
                  className="flex items-start gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 text-left transition hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                >
                  <Icon size={20} className="mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    <span className="flex items-center gap-1 font-semibold">
                      {label}
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Crown size={10} />
                        {planForFeature("pdfReports").name}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">Paketini yükselterek aç</span>
                  </span>
                </a>
              ) : (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFormat(value)}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-900/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <Icon size={20} className={`mt-0.5 shrink-0 ${selected ? "text-brand-600 dark:text-brand-300" : "text-slate-400"}`} />
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Araç">
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="input">
            <option value="">Tüm araçlar</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.plate ? ` (${v.plate})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="İçerik">
          <select value={content} onChange={(e) => setContent(e.target.value as ExportContent)} className="input">
            {Object.entries(CONTENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {content !== "reminders" ? (
          <Field label="Dönem">
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="input">
              {Object.entries(RANGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {content !== "reminders" && range === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input" />
            </Field>
            <Field label="Bitiş">
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input" />
            </Field>
          </div>
        ) : null}

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {result.rowCount === 0 ? (
            "Bu seçimde dışa aktarılacak kayıt yok."
          ) : (
            <>
              <b>{result.rowCount}</b> kayıt
              {content !== "reminders" ? (
                <>
                  {" "}
                  · toplam <b>{formatTL(result.total)}</b>
                </>
              ) : null}
            </>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {format === "csv"
            ? "CSV dosyası Excel, Numbers ve Google E-Tablolar ile açılır."
            : "PDF raporda özet rakamlar ve kayıtların tablosu yer alır."}
        </p>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <CancelButton onClick={onClose} />
        <button
          type="button"
          onClick={handleDownload}
          disabled={result.rowCount === 0 || working}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          <Download size={16} />
          {working ? "Hazırlanıyor…" : format === "pdf" ? "PDF İndir" : "Excel İndir"}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
