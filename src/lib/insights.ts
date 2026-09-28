import type { Expense, FuelEntry } from "../types";
import { analyzeConsumption } from "./consumption";
import { EXPENSE_CATEGORY_LABELS, formatNumber } from "./format";

export type InsightKind = "spending" | "consumption" | "cheapest" | "price" | "category";
/** good: better than before, warn: worse than before, info: neutral fact. */
export type InsightTone = "good" | "warn" | "info";

export interface Insight {
  kind: InsightKind;
  tone: InsightTone;
  /** Direction for the icon: up, down or none. */
  trend: "up" | "down" | null;
  text: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayMonth = (dateIso: string) =>
  new Date(`${dateIso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

/**
 * Short, personal observations for a vehicle's summary, most useful first (at most four):
 * spending against the same days of last month, the consumption trend of the last three measured
 * stretches, the cheapest recent fuel, the last price against the usual one, and this month's
 * biggest expense category. Each only appears when there is enough data to say it honestly.
 */
export function vehicleInsights(
  entries: FuelEntry[],
  expenses: Expense[],
  tankCapacity: number | undefined,
  today = new Date(),
): Insight[] {
  const out: Insight[] = [];
  const todayIso = iso(today);

  // 1. Spending so far this month vs. the same days of last month (fuel + other expenses).
  const day = today.getDate();
  const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevStart = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const prevEnd = iso(new Date(today.getFullYear(), today.getMonth() - 1, Math.min(day, prevDays)));
  const spentBetween = (from: string, to: string) =>
    entries.filter((e) => e.date >= from && e.date <= to).reduce((t, e) => t + e.totalCost, 0) +
    expenses.filter((x) => x.date >= from && x.date <= to).reduce((t, x) => t + x.amount, 0);
  const thisPeriod = spentBetween(monthStart, todayIso);
  const prevPeriod = spentBetween(prevStart, prevEnd);
  if (thisPeriod > 0 && prevPeriod > 0) {
    const change = pct(thisPeriod, prevPeriod);
    if (Math.abs(change) >= 5) {
      out.push({
        kind: "spending",
        tone: change > 0 ? "warn" : "good",
        trend: change > 0 ? "up" : "down",
        text: `Bu ay geçen ayın aynı dönemine göre %${Math.abs(change)} daha ${change > 0 ? "fazla" : "az"} harcadınız.`,
      });
    } else {
      out.push({
        kind: "spending",
        tone: "info",
        trend: null,
        text: "Bu ayki harcamanız geçen ayın aynı dönemiyle hemen hemen aynı.",
      });
    }
  }

  // 2. Consumption: the last three measured stretches vs. the ones before them.
  const segments = analyzeConsumption(entries, tankCapacity)
    .segments.filter((s) => !s.suspicious && s.kind !== "rough")
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  if (segments.length >= 4) {
    const rate = (list: typeof segments) =>
      (list.reduce((t, s) => t + s.liters, 0) / list.reduce((t, s) => t + s.km, 0)) * 100;
    const recent = rate(segments.slice(-3));
    const before = rate(segments.slice(-9, -3));
    const diff = recent - before;
    if (Math.abs(diff) >= 0.3) {
      out.push({
        kind: "consumption",
        tone: diff > 0 ? "warn" : "good",
        trend: diff > 0 ? "up" : "down",
        text: `Son 3 dolumda tüketiminiz ${formatNumber(Math.abs(diff), 1)} L/100km ${diff > 0 ? "arttı" : "azaldı"} (${formatNumber(recent, 1)} L).`,
      });
    }
  }

  // 3. Cheapest fuel in the last six months, and 4. the last price against the usual one.
  const sixMonthsAgo = iso(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()));
  const recentFills = entries.filter((e) => e.date >= sixMonthsAgo && e.pricePerLiter > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (recentFills.length >= 3) {
    const cheapest = recentFills.reduce((best, e) => (e.pricePerLiter < best.pricePerLiter ? e : best));
    const latest = recentFills[recentFills.length - 1];
    out.push({
      kind: "cheapest",
      tone: "info",
      trend: null,
      text:
        cheapest.id === latest.id
          ? `Son dolumunuz son 6 ayın en ucuz yakıtıydı (${formatNumber(cheapest.pricePerLiter, 2)} TL/L).`
          : `Son 6 ayın en ucuz yakıtını aldığınız gün: ${dayMonth(cheapest.date)} (${formatNumber(cheapest.pricePerLiter, 2)} TL/L).`,
    });
    const others = recentFills.slice(0, -1);
    const usual = others.reduce((t, e) => t + e.pricePerLiter, 0) / others.length;
    const change = pct(latest.pricePerLiter, usual);
    if (Math.abs(change) >= 3) {
      out.push({
        kind: "price",
        tone: change > 0 ? "warn" : "good",
        trend: change > 0 ? "up" : "down",
        text: `Son dolumda litre fiyatı ortalamanızdan %${Math.abs(change)} ${change > 0 ? "yüksekti" : "düşüktü"}.`,
      });
    }
  }

  // 5. This month's biggest expense category.
  const monthExpenses = expenses.filter((x) => x.date >= monthStart && x.date <= todayIso);
  const monthTotal = monthExpenses.reduce((t, x) => t + x.amount, 0);
  if (monthTotal > 0) {
    const byCategory = new Map<Expense["category"], number>();
    for (const x of monthExpenses) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount);
    const [category, amount] = [...byCategory].sort((a, b) => b[1] - a[1])[0];
    out.push({
      kind: "category",
      tone: "info",
      trend: null,
      text:
        byCategory.size === 1
          ? `Bu ayki masraflarınızın tamamı ${EXPENSE_CATEGORY_LABELS[category]} kaleminde.`
          : `Bu ayki masraflarınızda en büyük pay ${EXPENSE_CATEGORY_LABELS[category]}: %${Math.round((amount / monthTotal) * 100)}.`,
    });
  }

  return out.slice(0, 4);
}
