import { useEffect, useRef, useState } from "react";

/**
 * Horizontal scroller for wide tables without a visible scrollbar. Instead, an edge fade shows
 * there is more to the left or right, and disappears at that end. Vertical overscroll is locked
 * so the table doesn't wobble up and down on iOS.
 */
export default function ScrollX({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-900/10 to-transparent transition-opacity dark:from-black/40 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900/10 to-transparent transition-opacity dark:from-black/40 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
