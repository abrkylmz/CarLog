import { Children, useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Accent per slide (see index.css), so each dot wears its vehicle's color. */
  accents: (string | undefined)[];
  label: string;
}

/**
 * On phones, vehicle cards slide sideways one at a time (native scroll snapping, so it feels like
 * iOS) with the next card peeking in and dots below. From the sm breakpoint up it is the usual grid.
 */
export default function VehicleCarousel({ children, accents, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The slide whose center is closest to the scroller's center is the current one.
    const update = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      [...el.children].forEach((child, i) => {
        const c = child as HTMLElement;
        const distance = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      setActive(best);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
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
              className={`flex shrink-0 snap-center [&>*]:flex-1 sm:w-auto ${count > 1 ? "w-[86%]" : "w-full"}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5 sm:hidden">
          {accents.map((accent, i) => (
            <button
              key={i}
              type="button"
              data-accent={accent}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}. karta git`}
              aria-current={i === active ? "true" : undefined}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === active
                  ? `w-5 ${accent ? "bg-brand-500" : "bg-slate-500"}`
                  : "w-2 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
