import { Children, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Accent per slide (see index.css), so the indicator wears the current vehicle's color. */
  accents: (string | undefined)[];
  label: string;
}

const DOT_GAP = 16;
const DOT_R = 3.5;

/**
 * Vehicle cards in a sideways strip that snaps card by card: one card (and the next peeking in)
 * on phones, two on tablets, three on wide screens. Cards lean with the scroll speed and the
 * indicator flows between the dots like a drop of liquid. On computers the strip can be dragged
 * with the mouse or moved with the arrow buttons; touchpads scroll it natively.
 */
export default function VehicleCarousel({ children, accents, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const blobRef = useRef<SVGEllipseElement>(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: true });
  const count = Children.count(children);
  const filterId = `goo-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const slides = () => [...el.children] as HTMLElement[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastX = el.scrollLeft;
    let lastT = performance.now();
    let velocity = 0;
    let skew = 0;

    // Scroll progress spread over the cards: 0 = start, count - 1 = end.
    const position = () => {
      const max = el.scrollWidth - el.clientWidth;
      return max > 1 ? (el.scrollLeft / max) * (count - 1) : 0;
    };

    const tick = (now: number) => {
      const dt = Math.max(1, now - lastT);
      velocity = velocity * 0.8 + ((el.scrollLeft - lastX) / dt) * 0.2;
      lastX = el.scrollLeft;
      lastT = now;
      const pos = position();
      setActive(Math.round(pos));
      setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });

      skew += ((reduce.matches ? 0 : Math.max(-7, Math.min(7, -velocity * 5))) - skew) * 0.25;
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
    const wake = () => {
      if (frame) return;
      lastT = performance.now();
      frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    el.addEventListener("scroll", wake, { passive: true });
    const resize = new ResizeObserver(() => tick(performance.now()));
    resize.observe(el);

    // Mouse drag (touch and touchpads scroll natively). Snapping is paused while dragging, and a
    // drag doesn't count as a click on the card underneath.
    let drag: { x: number; left: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        el.style.scrollSnapType = "none";
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
        el.setPointerCapture(e.pointerId);
      }
      el.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      if (!moved) return;
      el.style.cursor = "";
      el.style.userSelect = "";
      // Settle on the nearest card, then hand snapping back to the browser.
      const nearest = slides().reduce(
        (best, s, i) => (Math.abs(s.offsetLeft - el.scrollLeft - el.offsetLeft) < best.d ? { i, d: Math.abs(s.offsetLeft - el.scrollLeft - el.offsetLeft) } : best),
        { i: 0, d: Infinity },
      ).i;
      scrollToSlide(el, nearest);
      window.setTimeout(() => (el.style.scrollSnapType = ""), 450);
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      el.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
    };
    // Cards are links: stop the browser from starting a link drag instead of our scroll drag.
    const noNativeDrag = (e: DragEvent) => e.preventDefault();
    el.addEventListener("dragstart", noNativeDrag);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("scroll", wake);
      el.removeEventListener("dragstart", noNativeDrag);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [count]);

  const goTo = (index: number) => ref.current && scrollToSlide(ref.current, Math.max(0, Math.min(count - 1, index)));
  // Arrows move one card from wherever the strip is now; snapping lines it up.
  const step = (direction: 1 | -1) => {
    const el = ref.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * (first.offsetWidth + 12), behavior: reduce ? "auto" : "smooth" });
  };
  const scrollable = !(edges.start && edges.end);
  const width = (count - 1) * DOT_GAP + (DOT_R + 4) * 2;
  // One card per view on phones, two on tablets, three on wide screens (gap 0.75rem).
  const slideWidth =
    count > 1
      ? "w-[86%] sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]"
      : "w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]";

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative">
      {/* The outer box bleeds to the screen edges on phones and clips the 20px strip where iOS
          Safari draws its scroll indicator (same trick as ScrollX). */}
      <div className="-mx-4 overflow-hidden sm:-mx-2">
        <div
          ref={ref}
          className="-mb-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-4 px-4 pb-5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:scroll-px-2 sm:px-2"
        >
          {Children.map(children, (child, i) => (
            <div
              className={`flex shrink-0 snap-center will-change-transform [&>*]:flex-1 sm:snap-start ${slideWidth}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Arrows for mouse users; they fade out at either end. */}
      {scrollable ? (
        <>
          <ArrowButton side="left" hidden={edges.start} onClick={() => step(-1)} />
          <ArrowButton side="right" hidden={edges.end} onClick={() => step(1)} />
        </>
      ) : null}

      {count > 1 && scrollable ? (
        <div className="relative mx-auto mt-3" style={{ width, height: 16 }}>
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

function scrollToSlide(el: HTMLDivElement, index: number) {
  const slide = el.children[index] as HTMLElement | undefined;
  if (!slide) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Phones center the card; wider screens line it up with the left edge (as the snap does).
  const centered = window.matchMedia("(max-width: 639px)").matches;
  const left = centered
    ? slide.offsetLeft - el.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2
    : slide.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).scrollPaddingLeft || "0");
  el.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
}

function ArrowButton({ side, hidden, onClick }: { side: "left" | "right"; hidden: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki araçlar" : "Sonraki araçlar"}
      tabIndex={hidden ? -1 : 0}
      className={`absolute top-[calc(50%-1.25rem)] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:text-brand-300 sm:flex ${
        side === "left" ? "-left-6" : "-right-6"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Icon size={18} />
    </button>
  );
}
