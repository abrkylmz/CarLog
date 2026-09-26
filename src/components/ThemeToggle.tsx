import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeMode, type ThemeMode } from "../lib/theme";

const NEXT: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeMode, string> = { system: "Sistem", light: "Açık", dark: "Koyu" };

/** One button that cycles Sistem → Açık → Koyu; the icon shows the current choice. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useThemeMode();
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      title={`Tema: ${LABEL[mode]} (değiştirmek için dokunun)`}
      aria-label={`Tema: ${LABEL[mode]}. ${LABEL[NEXT[mode]]} temaya geç`}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{LABEL[mode]}</span>
    </button>
  );
}
