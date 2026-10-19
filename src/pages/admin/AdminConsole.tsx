import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bug,
  Car,
  Fuel,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  ShieldHalf,
  Users,
  X,
} from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle";
import { api } from "../../lib/api";
import { paths } from "../../lib/router";
import type { User } from "../../types";

const Overview = lazy(() => import("./Overview"));
const UsersAdmin = lazy(() => import("./UsersAdmin"));
const ModeratorsAdmin = lazy(() => import("./ModeratorsAdmin"));
const SupportDesk = lazy(() => import("./SupportDesk"));
const CatalogAdmin = lazy(() => import("../../components/CatalogAdmin"));
const ErrorsAdmin = lazy(() => import("../../components/ErrorsAdmin"));

type SectionId = "genel" | "kullanicilar" | "moderatorler" | "destek" | "katalog" | "hatalar";

interface Section {
  id: SectionId;
  label: string;
  title: string;
  subtitle: string;
  icon: typeof Users;
  /** Moderators see only these; admins see everything. */
  staff?: boolean;
}

const SECTIONS: Section[] = [
  { id: "genel", label: "Genel Bakış", title: "Genel Bakış", subtitle: "Kullanıcılar, kullanım ve sistemin durumu bir bakışta.", icon: LayoutDashboard },
  { id: "kullanicilar", label: "Kullanıcılar", title: "Kullanıcılar", subtitle: "Hesaplar, roller, paketler ve şifreler.", icon: Users },
  { id: "moderatorler", label: "Moderatörler", title: "Moderatörler", subtitle: "Destek ekibini yönetin.", icon: ShieldHalf },
  { id: "destek", label: "Canlı Destek", title: "Canlı Destek", subtitle: "Kullanıcılardan gelen sorular ve hata bildirimleri.", icon: Headset, staff: true },
  { id: "katalog", label: "Araç Kataloğu", title: "Araç Kataloğu", subtitle: "Marka, model, depo hacmi ve fabrika tüketimi.", icon: Car },
  { id: "hatalar", label: "Hata Kayıtları", title: "Hata Kayıtları", subtitle: "Kullanıcıların tarayıcısında ve sunucuda oluşan hatalar.", icon: Bug, staff: true },
];

/**
 * The staff's own interface, separate from the app: a dark sidebar with the sections they may use
 * and a workspace. Admins get everything; moderators get the support desk and the error log.
 */
export default function AdminConsole({ user, section, onLogout }: { user: User; section: string; onLogout: () => void }) {
  const isAdmin = user.role === "admin";
  const allowed = SECTIONS.filter((s) => isAdmin || s.staff);
  const current = allowed.find((s) => s.id === section) ?? allowed[0];
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);

  // New support messages are counted in the sidebar, checked every half minute.
  useEffect(() => {
    let stopped = false;
    const check = () => api.supportUnread().then((u) => !stopped && setUnread(u.staff), () => undefined);
    void check();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void check(), 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [current.id]);

  useEffect(() => setDrawer(false), [current.id]);
  useEffect(() => {
    document.title = `${current.title} · CarLog Yönetim`;
    return () => {
      document.title = "CarLog — Yakıt Takibi";
    };
  }, [current.title]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
      <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Yönetim</p>
      {allowed.map((s) => {
        const active = s.id === current.id;
        return (
          <a
            key={s.id}
            href={paths.adminSection(s.id)}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-white shadow-inner" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <s.icon size={18} className={active ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"} />
            <span className="flex-1">{s.label}</span>
            {s.id === "destek" && unread > 0 ? (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 px-6 py-6">
        <span className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2.5 text-white shadow-lg shadow-brand-900/40">
          <Fuel size={20} />
        </span>
        <div>
          <p className="text-base font-bold leading-tight text-white">CarLog</p>
          <p className="text-xs text-slate-500">Yönetim Konsolu</p>
        </div>
      </div>
      {nav}
      <div className="m-3 rounded-2xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-sm font-bold uppercase text-white">
            {user.username.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.username}</p>
            <p className="flex items-center gap-1 text-xs text-slate-400">
              {isAdmin ? <ShieldCheck size={12} className="text-emerald-400" /> : <ShieldHalf size={12} className="text-sky-400" />}
              {isAdmin ? "Yönetici" : "Moderatör"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={paths.home} className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10">
            <ArrowLeft size={13} />
            Uygulama
          </a>
          <button type="button" onClick={onLogout} className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-xs font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-300">
            <LogOut size={13} />
            Çıkış
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <aside className="relative h-full w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setDrawer(false)} aria-label="Menüyü kapat" className="tap absolute right-3 top-6 z-10 rounded-lg p-1 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-8 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Menüyü aç" className="tap rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800">
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-400">Yönetim / {current.label}</p>
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{current.title}</h1>
            </div>
            <ThemeToggle className="h-9 w-9 justify-center rounded-xl px-0 [&>span]:hidden" />
          </div>
          <p className="mt-1 hidden text-sm text-slate-500 sm:block dark:text-slate-400">{current.subtitle}</p>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8">
          <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
            {current.id === "genel" ? <Overview /> : null}
            {current.id === "kullanicilar" ? <UsersAdmin currentUser={user} /> : null}
            {current.id === "moderatorler" ? <ModeratorsAdmin currentUser={user} /> : null}
            {current.id === "destek" ? <SupportDesk onUnreadChange={setUnread} /> : null}
            {current.id === "katalog" ? <CatalogAdmin /> : null}
            {current.id === "hatalar" ? <ErrorsAdmin canClear={isAdmin} /> : null}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
