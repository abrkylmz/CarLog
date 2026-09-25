import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  width?: string;
}

/** Centered panel for forms (edit, export). Esc, the close button or the backdrop close it. */
export default function Modal({ title, onClose, children, width = "max-w-lg" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab" && panelRef.current) {
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href]")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4 dark:bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-slate-50 p-4 shadow-xl sm:rounded-2xl sm:p-5 dark:border-slate-800 dark:bg-slate-950 ${width}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-semibold">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
