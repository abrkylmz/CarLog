import { useState } from "react";
import { BarChart3, Bell, Download, Fuel, LayoutGrid, MoreHorizontal, Receipt, Settings, Users } from "lucide-react";
import { navigate, paths, VEHICLE_TAB_LABELS, type VehicleTab } from "../lib/router";
import Modal from "./Modal";

const MAIN: { tab: VehicleTab; icon: typeof Fuel; label: string }[] = [
  { tab: "ozet", icon: LayoutGrid, label: "Özet" },
  { tab: "dolumlar", icon: Fuel, label: "Dolumlar" },
  { tab: "masraflar", icon: Receipt, label: "Masraflar" },
  { tab: "hatirlatmalar", icon: Bell, label: "Hatırlatma" },
];
const MORE: { tab: VehicleTab; icon: typeof Fuel }[] = [
  { tab: "aylik", icon: BarChart3 },
  { tab: "paylasim", icon: Users },
  { tab: "bilgiler", icon: Settings },
];

/** Phone-only tab bar fixed to the bottom of the screen; the less used tabs sit under "Diğer". */
export default function VehicleBottomNav({
  vehicleId,
  tab,
  onExport,
}: {
  vehicleId: string;
  tab: VehicleTab;
  onExport: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => m.tab === tab);
  const itemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
      active ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"
    }`;

  return (
    <>
      <nav
        aria-label="Araç sekmeleri"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:hidden"
      >
        {MAIN.map(({ tab: t, icon: Icon, label }) => (
          <a
            key={t}
            href={paths.vehicle(vehicleId, t)}
            aria-current={t === tab ? "page" : undefined}
            className={itemClass(t === tab)}
          >
            <Icon size={20} strokeWidth={t === tab ? 2.4 : 2} />
            {label}
          </a>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} className={itemClass(moreActive)} aria-haspopup="dialog">
          <MoreHorizontal size={20} strokeWidth={moreActive ? 2.4 : 2} />
          Diğer
        </button>
      </nav>

      {moreOpen ? (
        <Modal title="Diğer" onClose={() => setMoreOpen(false)} width="max-w-sm">
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {MORE.map(({ tab: t, icon: Icon }) => (
              <li key={t} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(paths.vehicle(vehicleId, t));
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    t === tab ? "text-brand-600 dark:text-brand-300" : ""
                  }`}
                >
                  <Icon size={18} />
                  {VEHICLE_TAB_LABELS[t]}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onExport();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download size={18} />
                Dışa Aktar
              </button>
            </li>
          </ul>
        </Modal>
      ) : null}
    </>
  );
}
