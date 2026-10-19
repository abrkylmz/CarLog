// Sends errors that happen in users' browsers to the server, where admins see them under
// Yönetici Paneli → Hatalar. Only the message, stack, page and browser go out; secret tokens in
// invite and password-reset links are blanked first.

const sent = new Set<string>();
let count = 0;

/** The page the error happened on, without the tokens in invite and reset links. */
function safeUrl(): string {
  return location.hash.replace(/(#\/(?:davet|sifre-sifirla)\/)[^/?]+/, "$1…").slice(0, 300);
}

export function reportError(error: unknown, context?: string): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = `${context ? `${context}: ` : ""}${e.message || String(error)}`.slice(0, 500);
    // The same error once per page load, and at most 10 in total, so a loop can't flood the log.
    if (sent.has(message) || count >= 10) return;
    sent.add(message);
    count++;
    void fetch("/api/errors", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack: e.stack?.slice(0, 4000), url: safeUrl() }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never cause an error of its own.
  }
}

/**
 * Browser notices that arrive as errors but aren't faults: ResizeObserver reports when a resize
 * (e.g. a chart fitting its box) takes one more frame; nothing breaks and nothing is lost.
 */
const BENIGN = [/^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/];

/** Uncaught errors and unhandled promise rejections anywhere in the app. */
export function installErrorReporting(): void {
  window.addEventListener("error", (e) => {
    if (!e.error && BENIGN.some((re) => re.test(e.message ?? ""))) return;
    reportError(e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    // Network failures are expected offline and are handled where they happen.
    if (reason && typeof reason === "object" && "status" in reason && (reason as { status: unknown }).status === 0) return;
    reportError(reason, "unhandledrejection");
  });
}
