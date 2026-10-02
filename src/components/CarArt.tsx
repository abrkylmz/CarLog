/**
 * A side-view car drawing painted in the surrounding accent color (the vehicle's fuel type, see
 * data-accent in index.css). Stands in for a photo on the dashboard cards and the hero.
 */
export default function CarArt({ className = "", light = false }: { className?: string; light?: boolean }) {
  // light: a white car, for drawing on top of an accent-colored background.
  const body = light ? "fill-slate-50" : "fill-brand-500";
  const sill = light ? "fill-slate-300" : "fill-brand-700/60";
  return (
    <svg viewBox="0 0 260 104" className={className} aria-hidden>
      {/* Ground shadow */}
      <ellipse cx="130" cy="94" rx="112" ry="7" className="fill-slate-900/15 dark:fill-black/40" />

      {/* Body */}
      <path
        d="M20 72 C20 62 25 57 38 55 L78 50 C92 37 108 28 132 27 L160 27 C180 27 196 35 211 48 L229 52 C242 55 248 61 248 70 L248 77 C248 80 246 82 243 82 L222 82 A24 24 0 0 0 174 82 L92 82 A24 24 0 0 0 44 82 L25 82 C22 82 20 80 20 77 Z"
        className={body}
      />
      {/* Lower sill, a shade darker */}
      <path d="M24 72 L246 70 L248 77 C248 80 246 82 243 82 L222 82 A24 24 0 0 0 174 82 L92 82 A24 24 0 0 0 44 82 L25 82 C22 82 20 80 20 77 Z" className={sill} />
      {/* Shoulder highlight */}
      <path d="M40 58 C90 52 170 50 226 55" fill="none" strokeWidth="2" strokeLinecap="round" className={light ? "stroke-white" : "stroke-white/35"} />

      {/* Windows */}
      <path d="M88 50 C99 40 111 33 130 32 L148 32 L148 50 Z" className="fill-slate-800/85 dark:fill-slate-950/85" />
      <path d="M154 32 L161 32 C177 32 190 39 200 50 L154 50 Z" className="fill-slate-800/85 dark:fill-slate-950/85" />
      <path d="M96 47 C104 40 114 36 126 35" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-white/25" />

      {/* Lights and handle */}
      <path d="M236 58 L246 61 L246 66 L234 64 Z" className="fill-amber-200" />
      <path d="M21 63 L30 61 L30 67 L21 68 Z" className="fill-red-500/90" />
      <rect x="160" y="56" width="12" height="2.5" rx="1.25" className="fill-white/40" />

      {/* Wheels */}
      {[68, 198].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="82" r="17" className="fill-slate-900 dark:fill-slate-950" />
          <circle cx={cx} cy="82" r="10" className="fill-slate-300 dark:fill-slate-500" />
          <circle cx={cx} cy="82" r="3.5" className="fill-slate-600" />
        </g>
      ))}
    </svg>
  );
}
