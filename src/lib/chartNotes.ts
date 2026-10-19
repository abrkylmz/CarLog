// What deserves a note on a monthly chart: the month the pump price jumped (or fell) most, and the
// one-off cost that stands out. A few notes at most, so they read as highlights, not noise.
import type { Expense, FuelEntry } from "../types";
import { EXPENSE_CATEGORY_LABELS, formatNumber, formatTL } from "./format";

export interface ChartNote {
  /** Position in the chart's months. */
  index: number;
  kind: "rise" | "drop" | "expense";
  /** The sentence under the chart. */
  text: string;
}

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthName = (key: string) => MONTH_NAMES[Number(key.slice(5, 7)) - 1];
const tl = (n: number) => formatTL(n).replace(",00", "");
/** A change smaller than this is the usual drift, not news. */
const PRICE_STEP = 0.03;
/** Below this a cost isn't remarkable however lonely it is. */
const BIG_EXPENSE = 2000;

/** Notes for the months `months` ("YYYY-MM", in chart order). */
export function chartNotes(months: string[], entries: FuelEntry[], expenses: Expense[]): ChartNote[] {
  const at = new Map(months.map((m, i) => [m, i]));
  const notes: ChartNote[] = [];

  // Average price per litre month by month, over all records so the first month has a "before".
  const byMonth = new Map<string, { cost: number; liters: number }>();
  for (const e of entries) {
    if (!(e.liters > 0) || !(e.totalCost > 0)) continue;
    const m = e.date.slice(0, 7);
    const t = byMonth.get(m) ?? { cost: 0, liters: 0 };
    t.cost += e.totalCost;
    t.liters += e.liters;
    byMonth.set(m, t);
  }
  const priced = [...byMonth].sort((a, b) => a[0].localeCompare(b[0])).map(([m, t]) => ({ m, price: t.cost / t.liters }));
  type Step = { m: string; from: number; to: number; change: number };
  let rise: Step | null = null as Step | null;
  let drop: Step | null = null as Step | null;
  for (let i = 1; i < priced.length; i++) {
    const { m, price } = priced[i];
    if (!at.has(m)) continue;
    const from = priced[i - 1].price;
    const change = price / from - 1;
    if (change >= PRICE_STEP && (!rise || change > rise.change)) rise = { m, from, to: price, change };
    if (change <= -PRICE_STEP && (!drop || change < drop.change)) drop = { m, from, to: price, change };
  }
  const litre = (n: number) => `₺${formatNumber(n, 2)}`;
  if (rise)
    notes.push({ index: at.get(rise.m)!, kind: "rise", text: `${monthName(rise.m)}: litre fiyatı %${Math.round(rise.change * 100)} arttı (${litre(rise.from)} → ${litre(rise.to)})` });
  if (drop)
    notes.push({ index: at.get(drop.m)!, kind: "drop", text: `${monthName(drop.m)}: litre fiyatı %${Math.round(-drop.change * 100)} düştü (${litre(drop.from)} → ${litre(drop.to)})` });

  // The single largest cost, if it's a real share of what was spent on expenses in these months.
  const inRange = expenses.filter((x) => at.has(x.date.slice(0, 7)));
  const all = inRange.reduce((t, x) => t + x.amount, 0);
  const top = inRange.reduce<Expense | null>((best, x) => (!best || x.amount > best.amount ? x : best), null);
  if (top && top.amount >= BIG_EXPENSE && top.amount >= all * 0.25) {
    const what = top.note?.trim() || EXPENSE_CATEGORY_LABELS[top.category];
    notes.push({ index: at.get(top.date.slice(0, 7))!, kind: "expense", text: `${monthName(top.date)}: ${what} ${tl(top.amount)}` });
  }
  return notes.sort((a, b) => a.index - b.index);
}
