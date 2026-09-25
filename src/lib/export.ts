import { withDerived } from "./calc";
import { EXPENSE_CATEGORY_LABELS, formatDate, REMINDER_KIND_LABELS } from "./format";
import type { Expense, FuelEntry, Reminder, Vehicle } from "../types";

export type ExportContent = "all" | "fuel" | "expenses" | "reminders";

export interface ExportOptions {
  content: ExportContent;
  /** null = all vehicles */
  vehicleId: string | null;
  /** Inclusive ISO dates; null = unbounded. Ignored for reminders. */
  from: string | null;
  to: string | null;
}

interface ExportData {
  vehicles: Vehicle[];
  entries: FuelEntry[];
  expenses: Expense[];
  reminders: Reminder[];
}

// Turkish Excel expects ";" between columns (the comma is the decimal separator)
// and needs a BOM to read the file as UTF-8, otherwise ç/ğ/ş come out garbled.
const SEPARATOR = ";";
const BOM = "﻿";

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Plain decimal-comma number without thousands separators, so Excel treats it as a number. */
function num(value: number | null | undefined, digits = 2): string {
  return value == null ? "" : value.toFixed(digits).replace(".", ",");
}

function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(cell).join(SEPARATOR)).join("\r\n") + "\r\n";
}

function inRange(date: string, from: string | null, to: string | null): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

export interface ExportResult {
  csv: string;
  rowCount: number;
  /** Money total of the exported rows (0 for reminders). */
  total: number;
}

export function buildExport(data: ExportData, options: ExportOptions): ExportResult {
  const vehicleById = new Map(data.vehicles.map((v) => [v.id, v]));
  const forVehicle = <T extends { vehicleId: string }>(items: T[]) =>
    options.vehicleId ? items.filter((i) => i.vehicleId === options.vehicleId) : items;
  const name = (id: string) => vehicleById.get(id)?.name ?? "";
  const plate = (id: string) => vehicleById.get(id)?.plate ?? "";

  if (options.content === "reminders") {
    const reminders = forVehicle(data.reminders).sort((a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    );
    const rows = reminders.map((r) => [
      name(r.vehicleId),
      plate(r.vehicleId),
      REMINDER_KIND_LABELS[r.kind],
      r.title ?? "",
      r.dueDate ? formatDate(r.dueDate) : "",
      num(r.dueKm, 0),
      r.repeatMonths ?? "",
      num(r.repeatKm, 0),
      r.doneAt ? `Tamamlandı (${formatDate(r.doneAt.slice(0, 10))})` : "Bekliyor",
      r.note ?? "",
      r.createdBy ?? "",
    ]);
    const header = [
      "Araç",
      "Plaka",
      "Tür",
      "Başlık",
      "Son Tarih",
      "Kilometre",
      "Tekrar (ay)",
      "Tekrar (km)",
      "Durum",
      "Not",
      "Ekleyen",
    ];
    return { csv: toCsv(header, rows), rowCount: rows.length, total: 0 };
  }

  type Row = { date: string; cells: (string | number | null | undefined)[]; amount: number };
  const rows: Row[] = [];

  if (options.content !== "expenses") {
    // L/100km depends on the previous fill-up, so derive per vehicle before filtering by date.
    const byVehicle = new Map<string, FuelEntry[]>();
    for (const e of forVehicle(data.entries)) byVehicle.set(e.vehicleId, [...(byVehicle.get(e.vehicleId) ?? []), e]);
    for (const list of byVehicle.values()) {
      for (const e of withDerived(list)) {
        if (!inRange(e.date, options.from, options.to)) continue;
        rows.push({
          date: e.date,
          amount: e.totalCost,
          cells: [
            formatDate(e.date),
            name(e.vehicleId),
            plate(e.vehicleId),
            "Yakıt",
            "Yakıt",
            num(e.totalCost),
            num(e.liters),
            num(e.pricePerLiter, 3),
            num(e.odometerKm, 0),
            num(e.consumptionPer100km),
            e.note ?? "",
            e.createdBy ?? "",
          ],
        });
      }
    }
  }

  if (options.content !== "fuel") {
    for (const x of forVehicle(data.expenses)) {
      if (!inRange(x.date, options.from, options.to)) continue;
      rows.push({
        date: x.date,
        amount: x.amount,
        cells: [
          formatDate(x.date),
          name(x.vehicleId),
          plate(x.vehicleId),
          "Masraf",
          EXPENSE_CATEGORY_LABELS[x.category],
          num(x.amount),
          "",
          "",
          "",
          "",
          x.note ?? "",
          x.createdBy ?? "",
        ],
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  const header = [
    "Tarih",
    "Araç",
    "Plaka",
    "Kayıt",
    "Kategori",
    "Tutar (TL)",
    "Litre",
    "TL/L",
    "Kilometre",
    "L/100km",
    "Not",
    "Ekleyen",
  ];
  return {
    csv: toCsv(
      header,
      rows.map((r) => r.cells),
    ),
    rowCount: rows.length,
    total: rows.reduce((t, r) => t + r.amount, 0),
  };
}

/** Saves text as a file; on iPhone this opens the share/save sheet. */
export function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ASCII-only slug for file names: "Aile Arabası" -> "aile-arabasi". */
export function slug(text: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return (
    text
      .toLocaleLowerCase("tr-TR")
      .replace(/[çğıöşü]/g, (c) => map[c])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "arac"
  );
}
