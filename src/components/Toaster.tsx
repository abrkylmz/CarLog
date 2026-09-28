import { useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

const EVENT = "carlog:toast";
const SHOW_MS = 2400;
let nextId = 1;

/** Shows a short confirmation ("Dolum kaydedildi") at the top of the screen. */
export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: nextId++, message } }));
}

/**
 * Mounted once in the app. The confirmation drops in from the top like the iPhone's Dynamic
 * Island, draws its check mark, and slips away after a moment. Screen readers hear it too.
 */
export default function Toaster() {
  const [current, setCurrent] = useState<Toast | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const onToast = (e: Event) => {
      setLeaving(false);
      setCurrent((e as CustomEvent<Toast>).detail);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!current) return;
    const hide = setTimeout(() => setLeaving(true), SHOW_MS);
    const remove = setTimeout(() => setCurrent(null), SHOW_MS + 300);
    return () => {
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [current]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center px-4"
    >
      {current ? (
        <div
          key={current.id}
          className={`toast flex items-center gap-2.5 rounded-full bg-slate-900 py-2 pl-2.5 pr-4 text-sm font-medium text-white shadow-xl shadow-slate-900/25 dark:bg-white dark:text-slate-900 ${
            leaving ? "toast-leave" : ""
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path className="toast-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {current.message}
        </div>
      ) : null}
    </div>
  );
}
