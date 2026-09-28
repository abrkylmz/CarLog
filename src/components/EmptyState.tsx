import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Friendly empty list: an icon in the vehicle's color floats inside a slowly turning ring. */
export default function EmptyState({ icon: Icon, title, text }: Props) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center dark:border-slate-700">
      <div className="relative mb-3 h-16 w-16">
        <svg viewBox="0 0 64 64" className="spin-slow absolute inset-0 text-brand-300 dark:text-brand-700" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
        </svg>
        <div className="float absolute inset-2 flex items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Icon size={24} />
        </div>
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}
