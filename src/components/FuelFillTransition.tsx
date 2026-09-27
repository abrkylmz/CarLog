import { useEffect, useRef, useState } from "react";
import { navigate } from "../lib/router";

/** What opening a vehicle from the garage asks the overlay to play. */
interface FillRequest {
  href: string;
  /** Vehicle accent palette (see index.css) the liquid takes its color from. */
  accent?: string;
  /** Tank size the pump counter counts up to, liters. */
  tank: number;
}

const EVENT = "carlog:fuel-fill";
const FILL_MS = 950;
const FADE_MS = 320;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Opens a vehicle page with the fuel-fill transition: the screen fills with a wavy liquid in the
 * vehicle's color while a pump counter counts up to the tank size, then the page appears.
 * Falls back to plain navigation when the user prefers reduced motion.
 */
export function openWithFuelFill(request: FillRequest): void {
  if (prefersReducedMotion()) {
    navigate(request.href);
    return;
  }
  window.dispatchEvent(new CustomEvent<FillRequest>(EVENT, { detail: request }));
}

/** Mounted once in the app; plays the transition when openWithFuelFill() asks for it. */
export default function FuelFillTransition() {
  const [request, setRequest] = useState<FillRequest | null>(null);
  const [fading, setFading] = useState(false);
  const back = useRef<SVGPathElement>(null);
  const front = useRef<SVGPathElement>(null);
  const counter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      setFading(false);
      setRequest((e as CustomEvent<FillRequest>).detail);
    };
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (!request) return;
    let frame = 0;
    let done = false;
    const timers: number[] = [];
    const start = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // The liquid surface is a sine wave in a 100×100 box; level 0 is empty, 1 is full.
    const wave = (level: number, amplitude: number, phase: number) => {
      const y = 104 - level * 108;
      let d = `M0 ${y}`;
      for (let x = 0; x <= 100; x += 4) d += ` L${x} ${(y + Math.sin((x / 100) * Math.PI * 2 + phase) * amplitude).toFixed(2)}`;
      return `${d} L100 100 L0 100 Z`;
    };
    const liters = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FILL_MS);
      const level = ease(t);
      back.current?.setAttribute("d", wave(level, 3.2, now / 170 + 1.7));
      front.current?.setAttribute("d", wave(level, 2.4, now / 170));
      if (counter.current) counter.current.textContent = liters.format(level * request.tank);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!done) {
        done = true;
        navigate(request.href);
        window.scrollTo(0, 0);
        timers.push(window.setTimeout(() => setFading(true), 60));
        timers.push(window.setTimeout(() => setRequest(null), 60 + FADE_MS));
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [request]);

  if (!request) return null;
  return (
    <div
      data-accent={request.accent}
      aria-hidden
      className={`fixed inset-0 z-50 transition-opacity ease-out ${fading ? "opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path ref={back} className="fill-brand-500" opacity={0.55} />
        <path ref={front} className="fill-brand-600" />
      </svg>
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.25)]">
        <span ref={counter} className="block text-5xl font-extrabold tabular-nums tracking-tight">
          0,0
        </span>
        <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.16em] opacity-85">
          Litre · Depo {request.tank} L
        </span>
      </div>
    </div>
  );
}
