import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

/**
 * A small pill near the top of the screen while the device is offline, or while records added
 * offline are still waiting to be sent.
 */
export default function OnlineStatus({ pending }: { pending: number }) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online && pending === 0) return null;
  return (
    // Sits just under where save confirmations drop in, so the two never cover each other.
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-[55] flex justify-center">
      <div role="status" className="toast whitespace-nowrap rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
        {online ? (
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={13} className="animate-spin" />
            {pending} kayıt gönderiliyor…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <CloudOff size={14} />
            Çevrimdışı{pending ? ` · ${pending} kayıt bekliyor` : " · son veriler gösteriliyor"}
          </span>
        )}
      </div>
    </div>
  );
}
