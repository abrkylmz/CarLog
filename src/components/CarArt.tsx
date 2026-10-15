import type { BodyType } from "../lib/bodyType";

// Side-view drawings per body style, facing right, on a 260×104 canvas. The wheel arches sit at
// the same place for every style, so the wheels, shadow and sill line up whatever the body.
interface Shape {
  /** Body outline. */
  body: string;
  /** Side windows. */
  windows: string[];
  /** Left edge of the body (the rear), where the sill starts. */
  rear: number;
  /** Height of the shoulder line and the lights. */
  shoulder: number;
}

const ARCHES = "L222 82 A24 24 0 0 0 174 82 L92 82 A24 24 0 0 0 44 82";

const SHAPES: Record<BodyType, Shape> = {
  sedan: {
    body: `M20 72 C20 62 25 57 38 55 L78 50 C92 37 108 28 132 27 L160 27 C180 27 196 35 211 48 L229 52 C242 55 248 61 248 70 L248 77 C248 80 246 82 243 82 ${ARCHES} L25 82 C22 82 20 80 20 77 Z`,
    windows: ["M88 50 C99 40 111 33 130 32 L148 32 L148 50 Z", "M154 32 L161 32 C177 32 190 39 200 50 L154 50 Z"],
    rear: 20,
    shoulder: 58,
  },
  hatchback: {
    body: `M24 74 C24 60 28 42 40 33 C46 29 56 27 70 27 L160 27 C180 27 196 35 211 48 L229 52 C242 55 248 61 248 70 L248 77 C248 80 246 82 243 82 ${ARCHES} L29 82 C26 82 24 80 24 77 Z`,
    windows: ["M46 50 C47 43 50 37 57 33 L100 32 L100 50 Z", "M106 32 L148 32 L148 50 L106 50 Z", "M154 32 L161 32 C177 32 190 39 200 50 L154 50 Z"],
    rear: 24,
    shoulder: 58,
  },
  suv: {
    body: `M18 70 C18 54 22 47 34 44 L52 26 C56 22 62 20 70 20 L170 20 C184 20 196 28 206 40 L230 46 C242 49 248 56 248 66 L248 77 C248 80 246 82 243 82 ${ARCHES} L23 82 C20 82 18 80 18 77 Z`,
    windows: ["M56 42 L64 28 C66 25 69 24 73 24 L104 24 L104 42 Z", "M110 24 L148 24 L148 42 L110 42 Z", "M154 24 L168 24 C180 24 190 31 198 42 L154 42 Z"],
    rear: 18,
    shoulder: 52,
  },
  station: {
    body: `M20 72 C20 60 24 52 32 44 L44 30 C48 27 54 26 62 26 L160 26 C180 26 196 35 211 48 L229 52 C242 55 248 61 248 70 L248 77 C248 80 246 82 243 82 ${ARCHES} L25 82 C22 82 20 80 20 77 Z`,
    windows: ["M48 48 L56 34 C58 31 61 30 65 30 L100 30 L100 48 Z", "M106 30 L148 30 L148 48 L106 48 Z", "M154 30 L161 30 C177 30 190 38 200 48 L154 48 Z"],
    rear: 20,
    shoulder: 56,
  },
  van: {
    body: `M14 78 L14 18 C14 13 18 10 23 10 L168 10 C176 10 182 13 188 20 L210 46 L232 50 C243 52 248 59 248 68 L248 77 C248 80 246 82 243 82 ${ARCHES} L18 82 C16 82 14 80 14 78 Z`,
    windows: ["M150 16 L172 16 C176 16 179 18 182 22 L198 44 L150 44 Z", "M100 16 L144 16 L144 44 L100 44 Z"],
    rear: 14,
    shoulder: 54,
  },
};

/**
 * A side-view car drawing painted in the surrounding accent color (the vehicle's fuel type, see
 * data-accent in index.css), in the vehicle's body style. Stands in for a photo.
 */
export default function CarArt({ className = "", light = false, body = "sedan" }: { className?: string; light?: boolean; body?: BodyType }) {
  // light: a white car, for drawing on top of an accent-colored background.
  const paint = light ? "fill-slate-50" : "fill-brand-500";
  const sill = light ? "fill-slate-300" : "fill-brand-700/60";
  const shape = SHAPES[body];
  const y = shape.shoulder;
  const x0 = shape.rear;

  return (
    <svg viewBox="0 0 260 104" className={className} aria-hidden>
      {/* Ground shadow */}
      <ellipse cx="130" cy="94" rx="112" ry="7" className="fill-slate-900/15 dark:fill-black/40" />

      <path d={shape.body} className={paint} />
      {/* Lower sill, a shade darker */}
      <path d={`M${x0 + 4} 72 L246 70 L248 77 C248 80 246 82 243 82 ${ARCHES} L${x0 + 5} 82 C${x0 + 2} 82 ${x0} 80 ${x0} 77 Z`} className={sill} />
      {/* Shoulder highlight */}
      <path
        d={`M${x0 + 20} ${y} C90 ${y - 6} 170 ${y - 8} 226 ${y - 3}`}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className={light ? "stroke-white" : "stroke-white/35"}
      />

      {shape.windows.map((d) => (
        <path key={d} d={d} className="fill-slate-800/85 dark:fill-slate-950/85" />
      ))}
      {body === "van" ? (
        // Sliding door seam on the van's load area.
        <path d="M94 16 L94 76" strokeWidth="1.5" className={light ? "stroke-slate-300" : "stroke-brand-700/50"} />
      ) : null}

      {/* Lights and handle */}
      <path d={`M236 ${y} L246 ${y + 3} L246 ${y + 8} L234 ${y + 6} Z`} className="fill-amber-200" />
      <path d={`M${x0 + 1} ${y + 5} L${x0 + 10} ${y + 3} L${x0 + 10} ${y + 9} L${x0 + 1} ${y + 10} Z`} className="fill-red-500/90" />
      <rect x="160" y={y - 2} width="12" height="2.5" rx="1.25" className="fill-white/40" />

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
