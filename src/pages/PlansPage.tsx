import { useState } from "react";
import { Check, Crown, Info, Minus, Sparkles } from "lucide-react";
import BackLink from "../components/BackLink";
import { useDialog } from "../components/DialogProvider";
import { toast } from "../components/Toaster";
import { errorMessage } from "../lib/api";
import { FEATURE_INFO, PLAN_PREVIEW, PLANS, planById, type Feature, type Plan } from "../lib/plans";
import type { User } from "../types";

interface Props {
  user: User;
  /** Vehicles the user owns (shared ones don't count toward the plan). */
  ownedCount: number;
  onChoose: (plan: Plan) => Promise<void>;
}

const ALL_FEATURES = Object.keys(FEATURE_INFO) as Feature[];
const tl = (n: number) => `₺${n.toLocaleString("tr-TR")}`;

/** Subscription plans: vehicle limits, what each includes, and switching between them. */
export default function PlansPage({ user, ownedCount, onChoose }: Props) {
  const dialog = useDialog();
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const current = planById(user.plan);

  async function choose(plan: Plan) {
    const over = ownedCount > plan.maxVehicles;
    const confirmed = await dialog.confirm({
      title: plan.monthlyPrice > 0 ? `${plan.name} paketine geçilsin mi?` : "Ücretsiz pakete geçilsin mi?",
      message: (
        <div className="space-y-2">
          {PLAN_PREVIEW && plan.monthlyPrice > 0 ? (
            <p>
              Ödeme altyapısı henüz hazır değil; bu bir önizleme. Paket şimdilik <b>ücretsiz</b> etkinleştirilecek, sizden
              ücret alınmayacak.
            </p>
          ) : null}
          <p>
            {plan.name} pakette en fazla <b>{plan.maxVehicles} araç</b> ekleyebilirsiniz.
          </p>
          {over ? (
            <p>
              Mevcut {ownedCount} aracınızın hepsi korunur; ancak sayı {plan.maxVehicles}'nin altına inmeden yeni araç
              ekleyemezsiniz.
            </p>
          ) : null}
        </div>
      ),
      confirmLabel: plan.monthlyPrice > 0 ? "Paketi Etkinleştir" : "Ücretsiz Pakete Geç",
      tone: over ? "danger" : "success",
    });
    if (!confirmed) return;
    setBusy(plan.id);
    try {
      await onChoose(plan);
      toast(`${plan.name} paketi etkin`);
    } catch (err) {
      await dialog.alert({ title: "Paket değiştirilemedi", message: errorMessage(err), tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <BackLink />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Crown size={24} className="text-amber-500" />
            Paketler
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Şu an <b className="text-slate-700 dark:text-slate-200">{current.name}</b> paketindesiniz ·{" "}
            <span className={ownedCount > current.maxVehicles ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
              {ownedCount} / {current.maxVehicles} araç
            </span>
          </p>
        </div>
        <div role="radiogroup" aria-label="Ödeme dönemi" className="grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 text-sm dark:bg-slate-800">
          {[
            [false, "Aylık"],
            [true, "Yıllık · 2 ay bedava"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={yearly === value}
              onClick={() => setYearly(value as boolean)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                yearly === value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {user.role === "admin" ? (
        <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <b>Yönetici hesabı:</b> paketinizden bağımsız olarak tüm özellikler açık ve araç sınırı yok.
        </p>
      ) : null}
      {PLAN_PREVIEW ? (
        <p className="mb-6 flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-900 dark:bg-brand-900/20 dark:text-brand-100">
          <Info size={18} className="mt-px shrink-0" />
          <span>
            <b>Önizleme:</b> ödeme altyapısı yakında geliyor. Bu süre içinde paketler ücretsiz etkinleştirilir; hiçbir
            ücret alınmaz.
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current.id;
          const price = yearly ? plan.monthlyPrice * 10 : plan.monthlyPrice;
          return (
            <section
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${
                plan.highlight
                  ? "border-brand-500 shadow-xl shadow-brand-900/10 ring-1 ring-brand-500 dark:border-brand-400 dark:ring-brand-400"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {plan.highlight ? (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
                  <Sparkles size={12} />
                  En popüler
                </span>
              ) : null}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-0.5 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight tabular-nums">{plan.monthlyPrice === 0 ? "₺0" : tl(price)}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{plan.monthlyPrice === 0 ? "her zaman" : yearly ? "/yıl" : "/ay"}</span>
              </p>
              {yearly && plan.monthlyPrice > 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Aylık {tl(Math.round((price / 12) * 100) / 100)} · {tl(plan.monthlyPrice * 2)} tasarruf</p>
              ) : (
                <p className="text-xs text-transparent">.</p>
              )}

              <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
                {plan.maxVehicles} araca kadar
              </p>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {ALL_FEATURES.map((f) => {
                  const included = plan.features.includes(f);
                  const info = FEATURE_INFO[f];
                  return (
                    <li key={f} className={`flex items-start gap-2 ${included ? "" : "text-slate-400 dark:text-slate-600"}`}>
                      {included ? (
                        <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      ) : (
                        <Minus size={16} className="mt-0.5 shrink-0" />
                      )}
                      <span>
                        {info.label}
                        {included && info.soon ? (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Yakında
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                disabled={isCurrent || busy != null}
                onClick={() => choose(plan)}
                className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-default ${
                  isCurrent
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : plan.highlight
                      ? "bg-brand-600 text-white shadow-md shadow-brand-900/20 hover:bg-brand-700 disabled:opacity-60"
                      : "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                }`}
              >
                {isCurrent ? "Mevcut paketiniz" : busy === plan.id ? "Etkinleştiriliyor…" : plan.monthlyPrice === 0 ? "Ücretsiz pakete geç" : "Paketi Seç"}
              </button>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        Araç sınırına yalnızca sahibi olduğunuz araçlar sayılır; sizinle paylaşılan araçlar sayılmaz. Paketinizi dilediğiniz
        zaman değiştirebilirsiniz.
      </p>
    </>
  );
}
