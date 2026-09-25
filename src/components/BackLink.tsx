import { ArrowLeft } from "lucide-react";
import { paths } from "../lib/router";

export default function BackLink() {
  return (
    <a
      href={paths.home}
      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
    >
      <ArrowLeft size={16} />
      Garajım
    </a>
  );
}
