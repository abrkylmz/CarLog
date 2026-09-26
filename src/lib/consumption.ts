import type { ConsumptionKind, ConsumptionSegment, DerivedEntry, FuelEntry } from "../types";

/** Outside this range a figure is almost surely a missed fill-up or a typo. */
export const PLAUSIBLE_MIN = 2;
export const PLAUSIBLE_MAX = 30;

const KIND_RANK: Record<ConsumptionKind, number> = { exact: 0, gauge: 1, rough: 2 };

/** The less reliable of two methods; used to label averages built from several stretches. */
export function weakerKind(a: ConsumptionKind | null, b: ConsumptionKind): ConsumptionKind {
  return a == null || KIND_RANK[b] > KIND_RANK[a] ? b : a;
}

function plausible(liters: number, km: number): boolean {
  const per100 = (liters / km) * 100;
  return per100 >= PLAUSIBLE_MIN && per100 <= PLAUSIBLE_MAX;
}

/**
 * Works out fuel consumption for one vehicle's fill-ups without assuming every fill-up is full.
 *
 * Fill-ups are ordered by odometer. For each stretch of driving the best available method wins:
 * 1. exact — between two full fill-ups: every liter bought in between (partial fills included)
 *    was burned over that distance, whatever the tank held along the way;
 * 2. gauge — fill-up to fill-up, from the tank capacity and the gauge reading before filling:
 *    fuel in the tank after the previous fill minus what was left before this one;
 * 3. rough — only when nothing above is available: all liters after the first fill-up over the
 *    whole distance; off by up to one tankful, so it only settles over long distances.
 */
export function analyzeConsumption(
  entries: FuelEntry[],
  tankCapacity?: number,
): { derived: DerivedEntry[]; segments: ConsumptionSegment[] } {
  const sorted = [...entries].sort(
    (a, b) => a.odometerKm - b.odometerKm || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const derived: DerivedEntry[] = sorted.map((e, i) => ({
    ...e,
    kmSinceLast: i > 0 ? e.odometerKm - sorted[i - 1].odometerKm : null,
    consumptionPer100km: null,
    consumptionKind: null,
    consumptionKm: null,
    suspicious: false,
    awaitingFull: false,
  }));
  const segments: ConsumptionSegment[] = [];
  const cap = tankCapacity && tankCapacity > 0 ? tankCapacity : null;

  function record(endIndex: number, km: number, liters: number, kind: ConsumptionKind) {
    const suspicious = !plausible(liters, km);
    segments.push({ endDate: sorted[endIndex].date, km, liters, kind, suspicious });
    const row = derived[endIndex];
    row.consumptionPer100km = (liters / km) * 100;
    row.consumptionKind = kind;
    row.consumptionKm = km;
    row.suspicious = suspicious;
  }

  // 1. Exact: full-to-full stretches. Remember which fill-to-fill gaps they cover.
  const coveredGap = new Set<number>(); // gap i = between fill i-1 and fill i
  let lastFull: number | null = null;
  sorted.forEach((e, i) => {
    if (e.isFull !== true) return;
    if (lastFull != null) {
      const km = e.odometerKm - sorted[lastFull].odometerKm;
      if (km > 0) {
        let liters = 0;
        for (let j = lastFull + 1; j <= i; j++) {
          liters += sorted[j].liters;
          coveredGap.add(j);
        }
        record(i, km, liters, "exact");
      }
    }
    lastFull = i;
  });
  // Partial fill-ups after the last full one wait for the next full fill-up to be measured.
  if (lastFull != null) {
    for (let i = lastFull + 1; i < sorted.length; i++) derived[i].awaitingFull = true;
  }

  // 2. Gauge: fill-to-fill for gaps no exact stretch covers.
  if (cap) {
    const after = (e: FuelEntry): number | null =>
      e.isFull ? cap : e.gaugeBefore != null ? Math.min(cap, e.gaugeBefore * cap + e.liters) : null;
    const before = (e: FuelEntry): number | null =>
      e.gaugeBefore != null ? e.gaugeBefore * cap : e.isFull ? Math.max(0, cap - e.liters) : null;
    for (let i = 1; i < sorted.length; i++) {
      if (coveredGap.has(i)) continue;
      const km = sorted[i].odometerKm - sorted[i - 1].odometerKm;
      const a = after(sorted[i - 1]);
      const b = before(sorted[i]);
      if (km <= 0 || a == null || b == null || a - b <= 0) continue;
      record(i, km, a - b, "gauge");
      derived[i].awaitingFull = false;
    }
  }

  // 3. Rough: nothing measurable at all, so estimate over the whole distance.
  if (segments.length === 0 && sorted.length >= 2) {
    const km = sorted[sorted.length - 1].odometerKm - sorted[0].odometerKm;
    const liters = sorted.slice(1).reduce((t, e) => t + e.liters, 0);
    if (km > 0) {
      segments.push({
        endDate: sorted[sorted.length - 1].date,
        km,
        liters,
        kind: "rough",
        suspicious: !plausible(liters, km),
      });
    }
  }

  return { derived, segments };
}

/** L/100km over trustworthy stretches (suspicious ones left out), with the weakest method used. */
export function averageOf(segments: ConsumptionSegment[]): {
  per100km: number | null;
  km: number;
  kind: ConsumptionKind | null;
} {
  let km = 0;
  let liters = 0;
  let kind: ConsumptionKind | null = null;
  for (const s of segments) {
    if (s.suspicious) continue;
    km += s.km;
    liters += s.liters;
    kind = weakerKind(kind, s.kind);
  }
  return { per100km: km > 0 ? (liters / km) * 100 : null, km, kind };
}

/** Gauge positions offered for partial fill-ups (fraction of a full tank). */
export const GAUGE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.05, label: "Rezerv / neredeyse boş" },
  { value: 0.125, label: "1/8" },
  { value: 0.25, label: "1/4" },
  { value: 0.375, label: "3/8" },
  { value: 0.5, label: "1/2" },
  { value: 0.625, label: "5/8" },
  { value: 0.75, label: "3/4" },
  { value: 0.875, label: "7/8" },
];

export function gaugeLabel(value: number): string {
  return GAUGE_OPTIONS.find((o) => Math.abs(o.value - value) < 0.01)?.label ?? `%${Math.round(value * 100)}`;
}

/** A gap this long between two fill-ups usually means one wasn't entered. */
const LONG_GAP_KM = 2000;

/**
 * Sanity checks before saving a fill-up, against the vehicle's other fill-ups (by date).
 * Returns human-readable warnings; empty when everything looks consistent.
 */
export function fillUpWarnings(
  input: { date: string; odometerKm: number; liters: number },
  others: FuelEntry[],
  tankCapacity?: number,
): string[] {
  const warnings: string[] = [];
  const earlier = others
    .filter((o) => o.date <= input.date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm)[0];
  const later = others
    .filter((o) => o.date > input.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm)[0];
  const km = (n: number) => n.toLocaleString("tr-TR");

  if (earlier && input.odometerKm <= earlier.odometerKm) {
    warnings.push(`Kilometre, ${earlier.date.split("-").reverse().join(".")} tarihli dolumdaki ${km(earlier.odometerKm)} km'den büyük olmalı.`);
  } else if (earlier && input.odometerKm - earlier.odometerKm > LONG_GAP_KM) {
    warnings.push(
      `Önceki dolumdan bu yana ${km(input.odometerKm - earlier.odometerKm)} km geçmiş; arada girilmemiş bir dolum olabilir.`,
    );
  }
  if (later && input.odometerKm >= later.odometerKm) {
    warnings.push(`Kilometre, ${later.date.split("-").reverse().join(".")} tarihli sonraki dolumdaki ${km(later.odometerKm)} km'den küçük olmalı.`);
  }
  if (tankCapacity && input.liters > tankCapacity * 1.05) {
    warnings.push(`${km(input.liters)} L, aracın ${km(tankCapacity)} L'lik deposundan fazla.`);
  }
  return warnings;
}
