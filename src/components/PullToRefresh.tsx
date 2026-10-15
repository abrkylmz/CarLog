import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/** How far (px) the indicator has to come down before letting go refreshes. */
const THRESHOLD = 72;
const MAX = 110;

/**
 * Pull down from the top of the page to reload the data, like native apps. iOS has no pull to
 * refresh for apps added to the home screen, so this does it on every touch screen (and stands in
 * for Safari's own, which would reload the whole page). Sideways swipes (the vehicle slider), open
 * dialogs and anything marked data-no-pull are left alone.
 */
export default function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** While the finger is down the indicator follows it exactly; on release it eases into place. */
  const [dragging, setDragging] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    if (!("ontouchstart" in window)) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;
    let distance = 0;

    const blocked = (target: EventTarget | null) =>
      document.querySelector('[role="dialog"]') != null || (target instanceof Element && target.closest("[data-no-pull]") != null);

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      decided = false;
      distance = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        decided = true;
        // Only a downward, mostly vertical drag is a pull; anything else is a normal scroll or swipe.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
      }
      if (window.scrollY > 0) {
        tracking = false;
        setPull(0);
        return;
      }
      e.preventDefault();
      setDragging(true);
      // Resistance: the indicator moves less than the finger, and less the further it goes.
      distance = Math.min(MAX, dy * 0.45);
      setPull(distance);
    };

    const onEnd = async () => {
      if (!tracking) return;
      tracking = false;
      setDragging(false);
      if (distance < THRESHOLD) {
        setPull(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPull(THRESHOLD * 0.8);
      try {
        // Keep the spinner up a moment even when the network is instant, so the refresh is seen.
        await Promise.all([refreshRef.current().catch(() => undefined), new Promise((r) => setTimeout(r, 600))]);
      } finally {
        busy.current = false;
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const progress = Math.min(1, pull / THRESHOLD);
  const ready = pull >= THRESHOLD || refreshing;

  return (
    <div
      aria-hidden={!refreshing}
      role={refreshing ? "status" : undefined}
      aria-label={refreshing ? "Yenileniyor" : undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(calc(env(safe-area-inset-top) + ${pull - 44}px))`,
        opacity: pull > 4 || refreshing ? 1 : 0,
        transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s",
      }}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 transition-colors dark:bg-slate-800 dark:ring-slate-700 ${
          ready ? "text-brand-600 dark:text-brand-300" : "text-slate-400"
        }`}
      >
        <RefreshCw
          size={19}
          className={refreshing ? "animate-spin" : ""}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </span>
    </div>
  );
}

