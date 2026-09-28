import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** True when the device asks for less motion (iOS: Settings → Accessibility → Motion). */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from the previous value (0 on first render) up to `target`, so figures tick into place
 * when a page opens and glide to the new total after a record is added.
 */
export function useCountUp(target: number, duration = 700): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const value = origin + (target - origin) * easeOutCubic(t);
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

// ---- Records leaving a list ---------------------------------------------------------
// A deleted record first slides out (the list marks it as leaving), then leaves the state.

const LEAVE_MS = 320;
let leaving = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Plays the leave animation for `id` and resolves when it is over. */
export async function animateOut(id: string): Promise<void> {
  if (prefersReducedMotion()) return;
  leaving = new Set(leaving).add(id);
  emit();
  await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
}

/** Call once the record is gone from state, so a re-added id isn't hidden. */
export function clearLeaving(id: string): void {
  if (!leaving.has(id)) return;
  leaving = new Set(leaving);
  leaving.delete(id);
  emit();
}

/** Ids currently sliding out; list rows add the leave animation for them. */
export function useLeavingIds(): Set<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => leaving,
  );
}
