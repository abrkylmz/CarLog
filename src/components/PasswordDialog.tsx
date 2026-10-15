import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { CancelButton } from "./EntryForm";
import Modal from "./Modal";
import { toast } from "./Toaster";

/** The signed-in user changes their own password; their other devices are signed out. */
export default function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("Yeni şifre en az 8 karakter olmalı.");
    if (next !== repeat) return setError("Yeni şifreler birbirini tutmuyor.");
    setError(null);
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast("Şifreniz değiştirildi");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <input type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={autoComplete} className="input" required />
    </label>
  );

  return (
    <Modal title="Şifremi Değiştir" onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {field("Mevcut şifre", current, setCurrent, "current-password")}
        {field("Yeni şifre (en az 8 karakter)", next, setNext, "new-password")}
        {field("Yeni şifre (tekrar)", repeat, setRepeat, "new-password")}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kaydedince diğer cihazlardaki oturumlarınız kapanır; bu cihazda açık kalır.
        </p>
        <div className="flex items-center justify-between gap-3">
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <span />}
          <div className="flex gap-2">
            <CancelButton onClick={onClose} />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
