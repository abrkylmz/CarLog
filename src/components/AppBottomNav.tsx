import { useState } from "react";
import { BarChart3, Car, ChevronRight, Crown, Download, Headset, Home, KeyRound, Mail, LayoutDashboard, LogOut, Play, Plus, UserRound } from "lucide-react";
import { planById } from "../lib/plans";
import { paths, type Route } from "../lib/router";
import { FUEL_ACCENT } from "../lib/theme";
import { FUEL_TYPE_LABELS } from "../lib/format";
import type { User, Vehicle } from "../types";
import Modal from "./Modal";
import { startQuickAdd } from "./QuickAdd";
import ThemeToggle from "./ThemeToggle";

interface Props {
  user: User;
  route: Route;
  vehicles: Vehicle[];
  wrappedYear: number | null;
  onExport: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onEditEmail: () => void;
  supportUnread: number;
}

type Sheet = "vehicles" | "reports" | "profile" | null;

/**
 * Phone tab bar for every screen except a vehicle's own pages (which have their tabs): home,
 * vehicles, the add button in the middle under the thumb, reports and the account.
 */
export default function AppBottomNav({ user, route, vehicles, wrappedYear, onExport, onChangePassword, onLogout, onDeleteAccount, onEditEmail, supportUnread }: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);
  const item = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
      active ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"
    }`;
  const row = "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-slate-50 dark:hover:bg-slate-800";

  return (
    <>
      <nav
        style={{ viewTransitionName: "tab-bar" }}
        aria-label="Ana gezinme"
        className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden dark:border-slate-800 dark:bg-slate-900/90"
      >
        <a href={paths.home} aria-current={route.name === "home" ? "page" : undefined} className={item(route.name === "home")}>
          <Home size={20} strokeWidth={route.name === "home" ? 2.4 : 2} />
          Ana Sayfa
        </a>
        <button type="button" onClick={() => setSheet("vehicles")} className={item(sheet === "vehicles")} aria-haspopup="dialog">
          <Car size={20} />
          Araçlar
        </button>
        <span className="flex flex-1 justify-center">
          {vehicles.length ? (
            <button
              type="button"
              onClick={() => startQuickAdd()}
              aria-label="Hızlı ekle: dolum, masraf veya hatırlatma"
              className="-mt-5 mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white transition active:scale-95 dark:ring-slate-900"
            >
              <Plus size={28} />
            </button>
          ) : (
            <a
              href={paths.newVehicle}
              aria-label="Araç ekle"
              className="-mt-5 mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white dark:ring-slate-900"
            >
              <Plus size={28} />
            </a>
          )}
        </span>
        <button type="button" onClick={() => setSheet("reports")} className={item(sheet === "reports" || route.name === "plans")} aria-haspopup="dialog">
          <BarChart3 size={20} />
          Raporlar
        </button>
        <button type="button" onClick={() => setSheet("profile")} className={`relative ${item(sheet === "profile" || route.name === "support")}`} aria-haspopup="dialog">
          {supportUnread > 0 ? <span className="absolute right-[calc(50%-14px)] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-slate-900" aria-label="Destekten yeni yanıt" /> : null}
          <UserRound size={20} />
          Profil
        </button>
      </nav>

      {sheet === "vehicles" ? (
        <Modal title="Araçlarım" onClose={close} width="max-w-md">
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {vehicles.map((v) => (
              <li key={v.id} data-accent={FUEL_ACCENT[v.fuelType]} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <a href={paths.vehicle(v.id)} onClick={close} className={row}>
                  <span className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                    <Car size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{v.name}</span>
                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                      {[v.plate, FUEL_TYPE_LABELS[v.fuelType]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </a>
              </li>
            ))}
            <li>
              <a href={paths.newVehicle} onClick={close} className={`${row} text-brand-600 dark:text-brand-300`}>
                <Plus size={18} />
                Araç Ekle
              </a>
            </li>
          </ul>
        </Modal>
      ) : null}

      {sheet === "reports" ? (
        <Modal title="Raporlar" onClose={close} width="max-w-md">
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 [&>li]:border-b [&>li]:border-slate-100 [&>li:last-child]:border-0 dark:[&>li]:border-slate-800">
            {wrappedYear != null ? (
              <li>
                <a href={paths.wrapped(wrappedYear)} onClick={close} className={row}>
                  <Play size={18} className="text-violet-600" />
                  {wrappedYear} Yıl Özeti
                </a>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onExport();
                }}
                className={row}
              >
                <Download size={18} />
                Dışa Aktar (Excel / PDF)
              </button>
            </li>
            <li>
              <a href={paths.plans} onClick={close} className={row}>
                <Crown size={18} className="text-amber-500" />
                <span className="flex-1">Paketler</span>
                <span className="text-xs text-slate-500">{planById(user.plan).name}</span>
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Araç bazında aylık rapor için aracın sayfasındaki Aylık Rapor sekmesine bakın.</p>
        </Modal>
      ) : null}

      {sheet === "profile" ? (
        <Modal title={user.username} onClose={close} width="max-w-md">
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 [&>li]:border-b [&>li]:border-slate-100 [&>li:last-child]:border-0 dark:[&>li]:border-slate-800">
            <li>
              <a href={paths.plans} onClick={close} className={row}>
                <Crown size={18} className="text-amber-500" />
                <span className="flex-1">Paketim</span>
                <span className="text-xs text-slate-500">{planById(user.plan).name}</span>
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onChangePassword();
                }}
                className={row}
              >
                <KeyRound size={18} />
                Şifremi Değiştir
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onEditEmail();
                }}
                className={row}
              >
                <Mail size={18} />
                <span className="min-w-0 flex-1 truncate">{user.email ? user.email : "E-posta ekle"}</span>
              </button>
            </li>
            <li className="flex items-center justify-between px-4 py-2 text-sm font-medium">
              Tema
              <ThemeToggle className="[&>span]:inline" />
            </li>
            <li>
              <a href={paths.support} onClick={close} className={row}>
                <Headset size={18} className="text-brand-600" />
                <span className="flex-1">Canlı Destek</span>
                {supportUnread > 0 ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{supportUnread}</span> : null}
              </a>
            </li>
            {user.role !== "user" ? (
              <li>
                <a href={paths.admin} onClick={close} className={row}>
                  <LayoutDashboard size={18} />
                  Yönetim Paneli
                </a>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onLogout();
                }}
                className={`${row} text-red-600 dark:text-red-400`}
              >
                <LogOut size={18} />
                Çıkış Yap
              </button>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => {
              close();
              onDeleteAccount();
            }}
            className="mt-3 w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-red-600 hover:underline dark:text-slate-400"
          >
            Hesabımı sil
          </button>
        </Modal>
      ) : null}
    </>
  );
}
