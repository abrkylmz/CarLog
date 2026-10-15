import { withDerived } from "./calc";
import { gaugeLabel } from "./consumption";
import { CONSUMPTION_KIND_LABELS, EXPENSE_CATEGORY_LABELS, formatDate, formatNumber, formatTL, REMINDER_KIND_LABELS } from "./format";
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

/** A narrower, readable version of the same rows for the PDF report (Turkish number format). */
export interface ExportTable {
  header: string[];
  rows: string[][];
  /** Relative column widths ("*" stretches); columns listed in `right` are right-aligned. */
  widths: (number | "*" | "auto")[];
  right: number[];
}

export interface ExportResult {
  csv: string;
  table: ExportTable;
  rowCount: number;
  /** Money total of the exported rows (0 for reminders). */
  total: number;
  /** Fuel and other-expense parts of the total, and the liters bought. */
  fuelTotal: number;
  otherTotal: number;
  liters: number;
}

const tr = (value: number | null | undefined, digits = 2) => (value == null ? "" : formatNumber(value, digits));

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
    const table: ExportTable = {
      header: ["Araç", "Tür", "Başlık", "Son Tarih", "Kilometre", "Tekrar", "Durum"],
      rows: reminders.map((r) => [
        name(r.vehicleId),
        REMINDER_KIND_LABELS[r.kind],
        r.title ?? "",
        r.dueDate ? formatDate(r.dueDate) : "",
        r.dueKm != null ? `${tr(r.dueKm, 0)} km` : "",
        [r.repeatMonths ? `${r.repeatMonths} ay` : "", r.repeatKm ? `${tr(r.repeatKm, 0)} km` : ""].filter(Boolean).join(" / "),
        r.doneAt ? `Tamamlandı (${formatDate(r.doneAt.slice(0, 10))})` : "Bekliyor",
      ]),
      widths: ["*", "auto", "*", "auto", "auto", "auto", "auto"],
      right: [4],
    };
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
    return { csv: toCsv(header, rows), table, rowCount: rows.length, total: 0, fuelTotal: 0, otherTotal: 0, liters: 0 };
  }

  type Row = { date: string; cells: (string | number | null | undefined)[]; pdf: string[]; amount: number; fuel: boolean; liters: number };
  const rows: Row[] = [];

  if (options.content !== "expenses") {
    // L/100km depends on the previous fill-up, so derive per vehicle before filtering by date.
    const byVehicle = new Map<string, FuelEntry[]>();
    for (const e of forVehicle(data.entries)) byVehicle.set(e.vehicleId, [...(byVehicle.get(e.vehicleId) ?? []), e]);
    for (const list of byVehicle.values()) {
      for (const e of withDerived(list, vehicleById.get(list[0].vehicleId)?.tankCapacity)) {
        if (!inRange(e.date, options.from, options.to)) continue;
        rows.push({
          date: e.date,
          amount: e.totalCost,
          fuel: true,
          liters: e.liters,
          pdf: [
            formatDate(e.date),
            name(e.vehicleId),
            e.fuel === "lpg" ? "Yakıt (LPG)" : e.fuel === "benzin" ? "Yakıt (benzin)" : "Yakıt",
            formatTL(e.totalCost),
            tr(e.liters),
            tr(e.pricePerLiter, 2),
            e.odometerKm != null ? tr(e.odometerKm, 0) : "",
            e.consumptionPer100km != null && !e.suspicious ? tr(e.consumptionPer100km, 1) : "",
            e.note ?? "",
          ],
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
            e.isFull === true
              ? "Full"
              : e.isFull === false
                ? `Kısmi${e.gaugeBefore != null ? ` (${gaugeLabel(e.gaugeBefore)})` : ""}`
                : "",
            num(e.consumptionPer100km),
            e.consumptionKind ? CONSUMPTION_KIND_LABELS[e.consumptionKind] + (e.suspicious ? " – olağandışı" : "") : "",
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
        fuel: false,
        liters: 0,
        pdf: [formatDate(x.date), name(x.vehicleId), EXPENSE_CATEGORY_LABELS[x.category], formatTL(x.amount), "", "", "", "", x.note ?? ""],
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
    "Depo",
    "L/100km",
    "Tüketim Yöntemi",
    "Not",
    "Ekleyen",
  ];
  return {
    csv: toCsv(
      header,
      rows.map((r) => r.cells),
    ),
    table: {
      header: ["Tarih", "Araç", "Kayıt", "Tutar", "Litre", "TL/L", "Km", "L/100km", "Not"],
      rows: rows.map((r) => r.pdf),
      widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto", "*"],
      right: [3, 4, 5, 6, 7],
    },
    rowCount: rows.length,
    total: rows.reduce((t, r) => t + r.amount, 0),
    fuelTotal: rows.filter((r) => r.fuel).reduce((t, r) => t + r.amount, 0),
    otherTotal: rows.filter((r) => !r.fuel).reduce((t, r) => t + r.amount, 0),
    liters: rows.reduce((t, r) => t + r.liters, 0),
  };
}

/** Saves text or binary data as a file; on iPhone this opens the share/save sheet. */
export function downloadFile(filename: string, content: string | Blob, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
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
