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
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fabrika Verisi (karma tüketim)</p>
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
