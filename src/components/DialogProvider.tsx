import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, KeyRound } from "lucide-react";

type Tone = "danger" | "success" | "info";

interface DialogOptions {
  title: string;
  message?: React.ReactNode;
  tone?: Tone;
  confirmLabel?: string;
  /** null hides the cancel button (plain notice). */
  cancelLabel?: string | null;
  /** Adds a text field; the dialog then resolves with its value. */
  input?: {
    label: string;
    type?: "text" | "password";
    /** Mobile keyboard, e.g. "decimal" for amounts. */
    inputMode?: "text" | "decimal" | "numeric";
    placeholder?: string;
    /** Returns an error message to keep the dialog open, or null to accept. */
    validate?: (value: string) => string | null;
  };
}

type Result = { confirmed: boolean; value: string };

interface DialogApi {
  /** Resolves true when the user confirms. */
  confirm: (options: DialogOptions) => Promise<boolean>;
  /** A notice with a single OK button. */
  alert: (options: Omit<DialogOptions, "cancelLabel" | "input">) => Promise<void>;
  /** Resolves with the entered text, or null when cancelled. */
  prompt: (options: DialogOptions & { input: NonNullable<DialogOptions["input"]> }) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used inside <DialogProvider>");
  return api;
}

interface OpenDialog {
  options: DialogOptions;
  resolve: (result: Result) => void;
}

/** In-app replacement for window.confirm/alert/prompt: a centered modal that matches the app. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<OpenDialog[]>([]);

  const open = useCallback(
    (options: DialogOptions) =>
      new Promise<Result>((resolve) => setQueue((q) => [...q, { options, resolve }])),
    [],
  );

  const close = (result: Result) => {
    queue[0]?.resolve(result);
    setQueue((q) => q.slice(1));
  };

  const api = useRef<DialogApi>({
    confirm: async (options) => (await open(options)).confirmed,
    alert: async (options) => void (await open({ ...options, cancelLabel: null })),
    prompt: async (options) => {
      const result = await open(options);
      return result.confirmed ? result.value : null;
    },
  }).current;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {queue[0] ? <Dialog key={queue.length} options={queue[0].options} onClose={close} /> : null}
    </DialogContext.Provider>
  );
}

const TONE_STYLES: Record<Tone, { icon: React.ReactNode; badge: string; button: string }> = {
  danger: {
    icon: <AlertTriangle size={20} />,
    badge: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40",
  },
  success: {
    icon: <CheckCircle2 size={20} />,
    badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    button: "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500/40",
  },
  info: {
    icon: <Info size={20} />,
    badge: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300",
    button: "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500/40",
  },
};

function Dialog({ options, onClose }: { options: DialogOptions; onClose: (result: Result) => void }) {
  const { title, message, tone = "info", confirmLabel = "Tamam", cancelLabel = "Vazgeç", input } = options;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const style = TONE_STYLES[tone];
  const cancel = () => onClose({ confirmed: false, value: "" });

  // Focus the dialog, lock page scroll, and give focus back to where it was on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Destructive confirms start on "Vazgeç" so a stray Enter can't delete anything.
    (inputRef.current ?? (tone === "danger" ? cancelRef.current : null) ?? confirmRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = input?.validate?.(value) ?? null;
    if (problem) return setError(problem);
    onClose({ confirmed: true, value });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && cancelLabel !== null) {
      e.stopPropagation();
      cancel();
    }
    // Keep Tab inside the dialog.
    if (e.key === "Tab" && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("button, input");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] dark:bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && cancelLabel !== null) cancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <form onSubmit={submit}>
          <div className="flex gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
              {input?.type === "password" ? <KeyRound size={20} /> : style.icon}
            </div>
            <div className="min-w-0 flex-1 pt-1.5">
              <h2 id={titleId} className="font-semibold">
                {title}
              </h2>
              {message ? (
                <div id={messageId} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {message}
                </div>
              ) : null}
            </div>
          </div>

          {input ? (
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">{input.label}</span>
              <input
                ref={inputRef}
                type={input.type ?? "text"}
                inputMode={input.inputMode}
                autoComplete={input.type === "password" ? "new-password" : "off"}
                placeholder={input.placeholder}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                className="input"
              />
              {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
            </label>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {cancelLabel !== null ? (
              <button
                ref={cancelRef}
                type="button"
                onClick={cancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-slate-400/30 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {cancelLabel}
              </button>
            ) : null}
            <button
              ref={confirmRef}
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white outline-none transition focus-visible:ring-4 ${style.button}`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
