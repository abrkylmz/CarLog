import { Children, useEffect, useId, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Accent per slide (see index.css), so the indicator wears the current vehicle's color. */
  accents: (string | undefined)[];
  label: string;
}

const DOT_GAP = 16;
const DOT_R = 3.5;

/**
 * On phones, vehicle cards slide sideways one at a time (native scroll snapping, so it feels like
 * iOS) with the next card peeking in. Cards lean with the swipe speed and the indicator below
 * flows like a drop of liquid between the dots. From the sm breakpoint up it is the usual grid.
 */
export default function VehicleCarousel({ children, accents, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const blobRef = useRef<SVGEllipseElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);
  const filterId = `goo-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const slides = () => [...el.children] as HTMLElement[];
    const phone = window.matchMedia("(max-width: 639px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastX = el.scrollLeft;
    let lastT = performance.now();
    let velocity = 0;
    let skew = 0;

    // Position in slides (0 = first card centered, 1 = second ...), continuous while swiping.
    const position = () => {
      const all = slides();
      if (all.length < 2) return 0;
      const center = el.scrollLeft + el.clientWidth / 2;
      const first = all[0].offsetLeft + all[0].offsetWidth / 2;
      const step = all[1].offsetLeft - all[0].offsetLeft;
      return Math.max(0, Math.min(all.length - 1, (center - first) / step));
    };

    const tick = (now: number) => {
      const dt = Math.max(1, now - lastT);
      velocity = velocity * 0.8 + ((el.scrollLeft - lastX) / dt) * 0.2;
      lastX = el.scrollLeft;
      lastT = now;
      const pos = position();
      setActive(Math.round(pos));

      const lean = phone.matches && !reduce.matches;
      skew += ((lean ? Math.max(-7, Math.min(7, -velocity * 5)) : 0) - skew) * 0.25;
      for (const slide of slides()) {
        slide.style.transform = Math.abs(skew) > 0.05 ? `skewX(${skew.toFixed(2)}deg)` : "";
      }
      const blob = blobRef.current;
      if (blob) {
        blob.setAttribute("cx", String(DOT_R + 4 + pos * DOT_GAP));
        blob.setAttribute("rx", String(DOT_R + 2 + (reduce.matches ? 0 : Math.min(9, Math.abs(velocity) * 12))));
      }
      frame = Math.abs(velocity) > 0.002 || Math.abs(skew) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => {
      if (frame) return;
      lastT = performance.now();
      frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  function goTo(index: number) {
    const el = ref.current;
    const slide = el?.children[index] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      left: slide.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const width = (count - 1) * DOT_GAP + (DOT_R + 4) * 2;

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      {/* The outer box bleeds to the screen edges and clips the 20px strip where iOS Safari
          draws its scroll indicator (same trick as ScrollX). */}
      <div className="-mx-4 overflow-hidden sm:mx-0 sm:overflow-visible">
        <div
          ref={ref}
          className="-mb-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-4 px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
        >
          {Children.map(children, (child, i) => (
            <div
              className={`flex shrink-0 snap-center will-change-transform [&>*]:flex-1 sm:w-auto ${count > 1 ? "w-[86%]" : "w-full"}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <div className="relative mx-auto mt-3 sm:hidden" style={{ width, height: 16 }}>
          {/* Blurred and re-thresholded, the blob and dots merge like liquid where they touch. */}
          <svg width={width} height={16} viewBox={`0 0 ${width} 16`} aria-hidden className="absolute inset-0 overflow-visible">
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" />
              <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" />
            </filter>
            <g filter={`url(#${filterId})`}>
              {accents.map((_, i) => (
                <circle key={i} cx={DOT_R + 4 + i * DOT_GAP} cy={8} r={DOT_R} className="fill-slate-300 dark:fill-slate-700" />
              ))}
              <g data-accent={accents[active]}>
                <ellipse
                  ref={blobRef}
                  cx={DOT_R + 4}
                  cy={8}
                  rx={DOT_R + 2}
                  ry={DOT_R + 2}
                  className={`transition-colors duration-300 ${accents[active] ? "fill-brand-500" : "fill-slate-500"}`}
                />
              </g>
            </g>
          </svg>
          {accents.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}. karta git`}
              aria-current={i === active ? "true" : undefined}
              className="absolute top-1/2 h-6 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: DOT_R + 4 + i * DOT_GAP }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
