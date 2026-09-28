import { Children, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Accent per slide (see index.css): the glow, progress line and backdrop title take it on. */
  accents: (string | undefined)[];
  /** Name per slide, set in large outline type behind the strip. */
  titles: string[];
  label: string;
}

/**
 * A centered "focus" slider. The current vehicle sits in the middle at full size with a glow in
 * its fuel color; its neighbours tip down along an arc like the rim of a wheel, get clipped and
 * lose color. Behind the cards the current name runs in huge outline type at a slower pace
 * (parallax). Below, a rolling "01 / 05" counter and a progress line. On computers the strip is
 * dragged with the mouse behind a "Sürükle" cursor, or moved with the arrows or a touchpad.
 */
export default function VehicleCarousel({ children, accents, titles, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);
  const multi = count > 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const slides = () => [...el.children] as HTMLElement[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    // Each card's distance from the center, in cards (0 = centered, ±1 = next door).
    const paint = () => {
      frame = 0;
      const all = slides();
      if (!all.length) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      const step = all.length > 1 ? all[1].offsetLeft - all[0].offsetLeft : all[0].offsetWidth;
      let nearest = 0;
      let nearestD = Infinity;
      const offsets = all.map((slide) => (slide.offsetLeft - el.offsetLeft + slide.offsetWidth / 2 - center) / step);
      offsets.forEach((p, i) => {
        if (Math.abs(p) < nearestD) {
          nearestD = Math.abs(p);
          nearest = i;
        }
      });
      all.forEach((slide, i) => {
        const p = offsets[i];
        const k = Math.min(1, Math.abs(p));
        const card = slide.firstElementChild as HTMLElement | null;
        if (reduce.matches || !multi) {
          slide.style.transform = "";
          if (card) card.style.clipPath = "";
          slide.style.filter = "";
          slide.style.setProperty("--glow", i === nearest && multi ? "1" : "0");
          return;
        }
        const d = Math.min(1.6, Math.abs(p));
        slide.style.transform = `translateY(${(d * d * 14).toFixed(1)}px) rotate(${(p * 3.2).toFixed(2)}deg) scale(${(1 - k * 0.06).toFixed(3)})`;
        // Clip the card, not the slide, so the slide's glow isn't cut off.
        if (card) card.style.clipPath = `inset(${(k * 7).toFixed(1)}% 0 ${(k * 7).toFixed(1)}% 0 round 12px)`;
        slide.style.filter = `saturate(${(1 - k * 0.7).toFixed(2)}) brightness(${(1 - k * 0.04).toFixed(3)})`;
        slide.style.setProperty("--glow", (1 - k).toFixed(2));
      });
      setActive(nearest);
      const max = el.scrollWidth - el.clientWidth;
      const progress = max > 1 ? el.scrollLeft / max : 1;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.max(0.04, progress)})`;
      // The backdrop title drifts at 30% of the scroll speed.
      if (titleRef.current && !reduce.matches) titleRef.current.style.transform = `translateX(${(-el.scrollLeft * 0.3).toFixed(1)}px)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener("scroll", schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(el);

    // Mouse drag (touch and touchpads scroll natively). Snapping pauses while dragging, and a
    // drag doesn't count as a click on the card underneath.
    let drag: { x: number; left: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
      cursorRef.current?.setAttribute("data-pressed", "");
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        el.style.scrollSnapType = "none";
        el.style.userSelect = "none";
        el.setPointerCapture(e.pointerId);
      }
      el.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      cursorRef.current?.removeAttribute("data-pressed");
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      if (!moved) return;
      el.style.userSelect = "";
      scrollToSlide(el, nearestIndex(el));
      window.setTimeout(() => (el.style.scrollSnapType = ""), 450);
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      el.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
    };
    const noNativeDrag = (e: DragEvent) => e.preventDefault(); // cards are links
    el.addEventListener("dragstart", noNativeDrag);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("scroll", schedule);
      el.removeEventListener("dragstart", noNativeDrag);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [count, multi]);

  // "Sürükle" cursor: trails the mouse with a little lag, only for a real mouse.
  useEffect(() => {
    const el = ref.current;
    const dot = cursorRef.current;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!el || !dot || !multi || !fine.matches || reduce.matches) return;
    const frameBox = dot.parentElement!;
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let frame = 0;
    let inside = false;
    const loop = () => {
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (target.y - pos.y) * 0.22;
      dot.style.translate = `${pos.x.toFixed(1)}px ${pos.y.toFixed(1)}px`;
      frame = inside || Math.abs(target.x - pos.x) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const box = frameBox.getBoundingClientRect();
      target.x = e.clientX - box.left;
      target.y = e.clientY - box.top;
      if (!inside) {
        inside = true;
        pos.x = target.x;
        pos.y = target.y;
        dot.dataset.visible = "";
      }
      if (!frame) frame = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      inside = false;
      delete dot.dataset.visible;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.classList.add("cursor-none");
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.classList.remove("cursor-none");
      cancelAnimationFrame(frame);
    };
  }, [multi]);

  const step = (direction: 1 | -1) =>
    ref.current && scrollToSlide(ref.current, Math.max(0, Math.min(count - 1, active + direction)));
  const two = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-accent={accents[active]}
      className={`relative ${
        multi
          ? "[--slide:82%] [--title:clamp(3.5rem,11vw,7rem)] sm:[--slide:56%] lg:[--slide:40%]"
          : "[--slide:100%] sm:[--slide:50%] lg:[--slide:33.333%]"
      }`}
    >
      {/* Backdrop title, tucked behind the top of the cards. */}
      {multi ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[var(--title)] overflow-hidden">
          <div ref={titleRef} className="will-change-transform">
            <p
              key={active}
              className="slider-title whitespace-nowrap pl-[6%] text-[length:var(--title)] font-black uppercase leading-none tracking-tight text-transparent [-webkit-text-stroke:1.5px_rgb(var(--brand-500)/0.35)] dark:[-webkit-text-stroke:1.5px_rgb(var(--brand-400)/0.3)]"
            >
              {titles[active]}
            </p>
          </div>
        </div>
      ) : null}

      {/* The cards start 60% of the way down the title, so they tuck over its lower part. */}
      <div className={`relative -mx-4 overflow-hidden sm:-mx-2 ${multi ? "pt-[calc(var(--title)*0.6)]" : ""}`}>
        <div
          ref={ref}
          className={`-mb-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-9 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            // Side padding of (100% - slide) / 2 leaves a content box exactly one slide wide, so
            // every card (first and last included) can snap to the center.
            multi ? "px-[calc((100%-var(--slide))/2)]" : "px-4 sm:px-2"
          }`}
        >
          {Children.map(children, (child, i) => (
            <div
              data-accent={accents[i]}
              className={`flex shrink-0 snap-center ${multi ? "w-full" : "w-[var(--slide)]"} rounded-xl shadow-[0_24px_48px_-24px_rgb(var(--brand-600)/calc(var(--glow)*0.75))] will-change-transform [--glow:0] [&>*]:flex-1`}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              {child}
            </div>
          ))}
        </div>

        {/* Mouse follower; hidden until the pointer is over the strip. */}
        <div
          ref={cursorRef}
          aria-hidden
          className="slider-cursor pointer-events-none absolute left-0 top-0 z-20 -ml-8 -mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/90 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur"
        >
          Sürükle
        </div>
      </div>

      {multi ? (
        <div className="mt-1 flex items-center gap-4">
          <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            <span className="inline-block overflow-hidden align-bottom leading-5">
              <span key={active} className="roll-in inline-block">
                {two(active + 1)}
              </span>
            </span>
            <span className="text-slate-400 dark:text-slate-500"> / {two(count)}</span>
          </span>
          <div className="relative h-[3px] flex-1 rounded-full bg-slate-200 dark:bg-slate-800">
            <div ref={progressRef} className="absolute inset-0 origin-left rounded-full bg-brand-500 transition-colors duration-300" />
            {/* Invisible jump targets along the line. */}
            <div className="absolute inset-x-0 -top-3 flex h-7">
              {Array.from({ length: count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => ref.current && scrollToSlide(ref.current, i)}
                  aria-label={`${i + 1}. karta git`}
                  aria-current={i === active ? "true" : undefined}
                  className="h-full flex-1"
                />
              ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <ArrowButton side="left" disabled={active === 0} onClick={() => step(-1)} />
            <ArrowButton side="right" disabled={active === count - 1} onClick={() => step(1)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function nearestIndex(el: HTMLDivElement): number {
  const center = el.scrollLeft + el.clientWidth / 2;
  let best = 0;
  let bestD = Infinity;
  [...el.children].forEach((child, i) => {
    const c = child as HTMLElement;
    const d = Math.abs(c.offsetLeft - el.offsetLeft + c.offsetWidth / 2 - center);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function scrollToSlide(el: HTMLDivElement, index: number) {
  const slide = el.children[index] as HTMLElement | undefined;
  if (!slide) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollTo({
    left: slide.offsetLeft - el.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2,
    behavior: reduce ? "auto" : "smooth",
  });
}

function ArrowButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Önceki araç" : "Sonraki araç"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-brand-300"
    >
      <Icon size={18} />
    </button>
  );
}
