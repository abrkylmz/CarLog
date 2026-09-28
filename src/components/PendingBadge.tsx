import { CloudOff } from "lucide-react";
import { isPending } from "../lib/outbox";

/** "Bekliyor" chip for a record added offline that hasn't reached the server yet. */
export default function PendingBadge({ id }: { id: string }) {
  if (!isPending(id)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      title="Çevrimdışı eklendi; bağlantı gelince gönderilecek"
    >
      <CloudOff size={10} />
      Bekliyor
    </span>
  );
}
