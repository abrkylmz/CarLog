import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Bug, Car, Fuel, Headset, Receipt, UserPlus, Users } from "lucide-react";
import { api, errorMessage, type AdminStats } from "../../lib/api";
import { paths } from "../../lib/router";
import { planById, type PlanId } from "../../lib/plans";

const PLAN_COLORS: Record<string, string> = { free: "#94a3b8", plus: "#3b82f6", pro: "#8b5cf6", fleet: "#10b981" };

/** The last 30 days as keys, so days without data still show as zero. */
function lastDays(rows: { day: string; n: number }[], count = 30) {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r.n]));
  const out: { day: string; label: string; n: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, label: d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }), n: byDay.get(key) ?? 0 });
  }
  return out;
}

export default function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminStats().then(setStats, (err) => setError(errorMessage(err)));
  }, []);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!stats)
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    );

  const signups = lastDays(stats.signups);
  const fillUps = lastDays(stats.fillUps);
  const planTotal = stats.plans.reduce((s, p) => s + p.n, 0) || 1;

  const kpis = [
    { label: "Toplam kullanıcı", value: stats.users, hint: `${stats.admins} yönetici · ${stats.moderators} moderatör`, icon: Users, tone: "from-brand-500 to-brand-700" },
    { label: "Son 7 gün aktif", value: stats.active7, hint: `30 günde ${stats.active30} kişi`, icon: Activity, tone: "from-emerald-500 to-teal-600" },
    { label: "Yeni üye (7 gün)", value: stats.new7, hint: "Kayıt olan hesaplar", icon: UserPlus, tone: "from-violet-500 to-fuchsia-600" },
    { label: "Araç", value: stats.vehicles, hint: "Tüm hesaplarda", icon: Car, tone: "from-sky-500 to-blue-600" },
    { label: "Dolum kaydı", value: stats.entries, hint: "Toplam", icon: Fuel, tone: "from-amber-500 to-orange-600" },
    { label: "Masraf kaydı", value: stats.expenses, hint: "Toplam", icon: Receipt, tone: "from-rose-500 to-pink-600" },
    {
      label: "Açık destek",
      value: stats.supportOpen,
      hint: stats.supportUnread ? `${stats.supportUnread} yanıt bekliyor` : "Bekleyen yok",
      icon: Headset,
      tone: "from-cyan-500 to-sky-600",
      href: paths.adminSection("destek"),
      alert: stats.supportUnread > 0,
    },
    {
      label: "Hata (24 saat)",
      value: stats.errors24h,
      hint: stats.errors24h ? "İncelemek için tıklayın" : "Sorun görünmüyor",
      icon: Bug,
      tone: "from-slate-500 to-slate-700",
      href: paths.adminSection("hatalar"),
      alert: stats.errors24h > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">{k.label}</p>
                <span className={`shrink-0 rounded-xl bg-gradient-to-br ${k.tone} p-1.5 text-white shadow-sm sm:p-2`}>
                  <k.icon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold sm:text-3xl tabular-nums tracking-tight">{k.value.toLocaleString("tr-TR")}</p>
              <p className={`mt-1 text-xs ${k.alert ? "font-semibold text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>{k.hint}</p>
            </>
          );
          const cls = "card block p-4 sm:p-5";
          return k.href ? (
            <a key={k.label} href={k.href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md`}>
              {body}
            </a>
          ) : (
            <div key={k.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Yeni kayıtlar" subtitle="Son 30 gün" data={signups} color="#8b5cf6" id="signups" />
        <ChartCard title="Dolum kayıtları" subtitle="Son 30 gün" data={fillUps} color="#f59e0b" id="fills" />
        <div className="card p-5">
          <p className="font-semibold">Paket dağılımı</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Kullanıcıların seçtiği paketler</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {stats.plans.map((p) => (
              <span key={p.plan} style={{ width: `${(p.n / planTotal) * 100}%`, background: PLAN_COLORS[p.plan] ?? "#64748b" }} />
            ))}
          </div>
          <ul className="mt-4 space-y-2.5">
            {stats.plans.map((p) => (
              <li key={p.plan} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[p.plan] ?? "#64748b" }} />
                <span className="flex-1">{planById(p.plan as PlanId).name}</span>
                <span className="font-semibold tabular-nums">{p.n}</span>
                <span className="w-12 text-right text-xs text-slate-400">%{Math.round((p.n / planTotal) * 100)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, data, color, id }: { title: string; subtitle: string; data: { label: string; n: number }[]; color: string; id: string }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums">{total}</p>
      </div>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={6} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v) => [v as number, title]}
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="n" stroke={color} strokeWidth={2} fill={`url(#g-${id})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
