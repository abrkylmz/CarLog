import { Component, type ReactNode } from "react";
import { reportError } from "../lib/errorReporting";

/**
 * If a screen crashes while rendering, shows a way back instead of a blank page and sends the error
 * to the admin's error log.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, "render");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">Bir şeyler ters gitti</p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Bu hata bize iletildi. Sayfayı yenileyerek devam edebilirsiniz; kayıtlarınız güvende.
        </p>
        <button
          type="button"
          onClick={() => {
            location.hash = "#/";
            location.reload();
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Yenile
        </button>
      </div>
    );
  }
}
