import { useState } from "react";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { paths } from "../lib/router";
import { openQuickAdd } from "./QuickAdd";

export interface StartState {
  userId: string;
  firstVehicleId: string;
  hasEntry: boolean;
  hasConsumption: boolean;
  hasReminder: boolean;
  hasCity: boolean;
  hasBudget: boolean;
  onEditBudget: () => void;
}

const hiddenKey = (userId: string) => `carlog:start-hidden:${userId}`;

/**
 * "Başlarken": the few steps that make the app useful, ticked off from the data itself. Disappears
 * once everything is done, or when hidden (remembered on this device).
 */
export default function StartChecklist(s: StartState) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenKey(s.userId)) === "1";
    } catch {
      return false;
    }
  });

  const steps = [
    { label: "Aracını ekle", done: true },
    { label: "İlk dolumunu kaydet", hint: "Pompada tutarı yazman yeterli", done: s.hasEntry, action: () => openQuickAdd("entry", s.firstVehicleId) },
    { label: "Gerçek tüketimini öğren", hint: "İkinci full dolumda L/100 km hesaplanır", done: s.hasConsumption, action: () => openQuickAdd("entry", s.firstVehicleId) },
    { label: "Muayene ya da sigorta tarihini gir", hint: "Zamanı gelince hatırlatalım", done: s.hasReminder, href: paths.vehicle(s.firstVehicleId, "hatirlatmalar") },
    { label: "Şehrini seç", hint: "Güncel yakıt fiyatı için", done: s.hasCity, href: "#akaryakit" },
    { label: "Aylık bütçe belirle", hint: "Harcamanı hedefle karşılaştır", done: s.hasBudget, action: s.onEditBudget },
  ];
  const done = steps.filter((x) => x.done).length;
  if (hidden || done === steps.length) return null;
  const next = steps.findIndex((x) => !x.done);

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(s.userId), "1");
    } catch {
      // Not remembered; it comes back next time.
    }
  }

  return (
    <section aria-label="Başlarken" className="card overflow-hidden">
      <div className="flex items-start gap-3 bg-gradient-to-br from-brand-50 to-transparent px-4 pb-3 pt-4 dark:from-brand-900/30">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-900/20">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold tracking-tight">Başlarken</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {steps.length} adımdan {done}'i tamam
          </p>
        </div>
        <button type="button" onClick={hide} aria-label="Başlarken listesini gizle" className="tap -mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X size={18} />
        </button>
      </div>
      <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${steps.length} adımın ${done}'i tamam`}>
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-2 pb-2">
        {steps.map((x, i) => {
          const body = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  x.done ? "bg-emerald-500 text-white" : i === next ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {x.done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${x.done ? "text-slate-500 line-through decoration-slate-300 dark:text-slate-400 dark:decoration-slate-600" : i === next ? "font-semibold" : ""}`}>{x.label}</span>
                {!x.done && x.hint ? <span className="block text-xs text-slate-500 dark:text-slate-400">{x.hint}</span> : null}
              </span>
              {!x.done ? <ChevronRight size={17} className="shrink-0 text-slate-400" /> : null}
            </>
          );
          const cls = "flex w-full items-center gap-3 px-4 py-2 text-left";
          return (
            <li key={x.label}>
              {x.done ? (
                <div className={cls}>{body}</div>
              ) : x.href ? (
                <a href={x.href} className={`${cls} transition hover:bg-slate-50 dark:hover:bg-white/[0.03]`} onClick={x.href.startsWith("#akaryakit") ? scrollToPrices : undefined}>
                  {body}
                </a>
              ) : (
                <button type="button" onClick={x.action} className={`${cls} transition hover:bg-slate-50 dark:hover:bg-white/[0.03]`}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function scrollToPrices(e: React.MouseEvent) {
  e.preventDefault();
  document.getElementById("akaryakit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
