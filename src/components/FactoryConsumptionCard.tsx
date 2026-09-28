import { useEffect, useState } from "react";
import { Factory } from "lucide-react";
import { formatNumber } from "../lib/format";
import type { ConsumptionKind, FactoryConsumption, FuelType } from "../types";

interface Props {
  factory: FactoryConsumption[] | undefined;
  fuelType: FuelType;
  /** The vehicle's measured average, L/100km. */
  measured: number | null;
  measuredKind: ConsumptionKind | null;
}

/**
 * How far above the official figure real-world use usually lands. NEDC (the pre-2018 cycle) is
 * known to be very optimistic; WLTP is much closer to real driving.
 */
const TYPICAL_GAP: Record<FactoryConsumption["cycle"], { max: number; label: string }> = {
  NEDC: { max: 40, label: "%20–40" },
  WLTP: { max: 15, label: "%5–15" },
};

/** Manufacturer consumption next to the measured average, read with the test cycle in mind. */
export default function FactoryConsumptionCard({ factory, fuelType, measured, measuredKind }: Props) {
  // Factory LPG models carry their own LPG figure; otherwise LPG cars compare against petrol.
  const figure =
    factory?.find((f) => f.fuelType === fuelType) ??
    (fuelType === "benzin-lpg" ? factory?.find((f) => f.fuelType === "benzin") : undefined);
  if (!figure) return null;

  const gap = TYPICAL_GAP[figure.cycle];
  const diff = measured != null ? (measured / figure.lPer100km - 1) * 100 : null;
  let verdict: { text: string; tone: string } | null = null;
  if (diff != null) {
    if (diff < 0) {
      verdict = { text: "Fabrika değerinin altında — çok ekonomik kullanım.", tone: "text-emerald-700 dark:text-emerald-400" };
    } else if (diff <= gap.max) {
      verdict = {
        text: `Normal aralıkta: ${figure.cycle} değerleri gerçek kullanımda genelde ${gap.label} aşılır.`,
        tone: "text-emerald-700 dark:text-emerald-400",
      };
    } else {
      verdict = {
        text: `Beklenenden yüksek (${figure.cycle} için olağan fark ${gap.label}). Şehir içi kullanım, lastik basıncı veya bakım etkili olabilir.`,
        tone: "text-amber-700 dark:text-amber-400",
      };
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Factory size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fabrika Verisi (karma tüketim)</p>
            {diff != null ? <GapGauge diff={diff} normalMax={gap.max} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-2xl font-semibold tracking-tight">
              {formatNumber(figure.lPer100km, 1)} <span className="text-base font-medium">L/100km</span>
            </p>
            {diff != null ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Sizinki {formatNumber(measured!, 1)} L ·{" "}
                <span className="font-semibold">
                  {diff >= 0 ? "+" : "−"}%{formatNumber(Math.abs(diff), 0)}
                </span>
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {figure.engine}
            {figure.fuelType !== fuelType ? " · benzin değeri" : ""} · {figure.cycle} ölçümü
          </p>
          {verdict ? (
            <p className={`mt-2 text-sm ${verdict.tone}`}>
              {verdict.text}
              {measuredKind === "rough" ? " (Sizin ortalamanız henüz kaba bir tahmin.)" : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Birkaç dolum sonra kendi tüketiminizle karşılaştırılacak.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const GAUGE_MIN = -20;

/**
 * Half-dial for the gap to the factory figure: green up to the cycle's usual gap, amber above it.
 * The needle sweeps in from the left when the card appears.
 */
function GapGauge({ diff, normalMax }: { diff: number; normalMax: number }) {
  const max = normalMax * 2;
  const angleOf = (v: number) => -90 + ((Math.max(GAUGE_MIN, Math.min(max, v)) - GAUGE_MIN) / (max - GAUGE_MIN)) * 180;
  const [angle, setAngle] = useState(-90);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAngle(angleOf(diff)));
    return () => cancelAnimationFrame(frame);
  }, [diff, normalMax]); // angleOf depends only on these

  // Arc from angle a to b (degrees, 0 = straight up) on a circle of radius 30 around (40, 38).
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(40 + 30 * Math.cos(rad)).toFixed(2)} ${(38 + 30 * Math.sin(rad)).toFixed(2)}`;
  };
  const arc = (a: number, b: number) => `M${point(a)} A30 30 0 0 1 ${point(b)}`;
  const split = angleOf(normalMax);

  return (
    <svg viewBox="0 0 80 44" className="h-11 w-20 shrink-0" role="img" aria-label={`Fabrika değerine göre fark: yüzde ${Math.round(diff)}`}>
      <path d={arc(-90, split)} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-emerald-400 dark:stroke-emerald-500" />
      <path d={arc(split, 90)} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-amber-400 dark:stroke-amber-500" />
      <g
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: "40px 38px" }}
        className="transition-transform duration-1000 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none"
      >
        <path d="M40 38 L38.4 36 L40 13 L41.6 36 Z" className="fill-slate-700 dark:fill-slate-200" />
      </g>
      <circle cx="40" cy="38" r="3.5" className="fill-slate-700 dark:fill-slate-200" />
    </svg>
  );
}
