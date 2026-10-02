import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

const TONES = {
  emerald: { box: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400", fill: "fill-emerald-400/15", stroke: "stroke-emerald-400", bar: "fill-emerald-400" },
  brand: { box: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300", fill: "fill-brand-500/15", stroke: "stroke-brand-500", bar: "fill-brand-500" },
  rose: { box: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400", fill: "fill-rose-400/15", stroke: "stroke-rose-400", bar: "fill-rose-400" },
  violet: { box: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400", fill: "fill-violet-400/15", stroke: "stroke-violet-400", bar: "fill-violet-400" },
};

interface Props {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Percent change; shown as a badge, green when it moved the good way. */
  change?: number | null;
  changeTitle?: string;
  lowerIsBetter?: boolean;
  /** Recent history, oldest first, drawn in the corner. */
  history?: number[];
  historyAs?: "area" | "bars";
}

/** A summary figure with its change badge and a small chart of its recent history. */
export default function TrendStat({ icon: Icon, tone, label, value, hint, change, changeTitle, lowerIsBetter, history, historyAs = "area" }: Props) {
  const t = TONES[tone];
  const showChange = change != null && change !== 0;
  const good = showChange && (lowerIsBetter ? change! < 0 : change! > 0);

  return (
    <div className="relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className={`hidden rounded-xl p-2.5 sm:block ${t.box}`}>
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">{label}</p>
            {showChange ? (
              <span
                title={changeTitle}
                className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  good
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                }`}
              >
                {change! < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}%{Math.abs(change!)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
          {hint ? <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
        </div>
      </div>
      {history && history.some((v) => v > 0) ? <Spark values={history} as={historyAs} tone={t} /> : null}
    </div>
  );
}

function Spark({ values, as, tone }: { values: number[]; as: "area" | "bars"; tone: (typeof TONES)[keyof typeof TONES] }) {
  const w = 120;
  const h = 34;
  const max = Math.max(...values);
  const min = as === "bars" ? 0 : Math.min(...values);
  const span = max - min || 1;
  const y = (v: number) => h - 2 - ((v - min) / span) * (h - 6);

  if (as === "bars") {
    const step = w / values.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-auto h-8 w-28 self-end" aria-hidden>
        {values.map((v, i) => (
          <rect key={i} x={i * step + step * 0.22} width={step * 0.56} y={y(v)} height={Math.max(2, h - y(v))} rx="1.5" className={tone.bar} opacity={0.45 + (0.55 * (i + 1)) / values.length} />
        ))}
      </svg>
    );
  }

  // A smooth line through the points (Catmull-Rom turned into cubic Béziers), filled below.
  const pts = values.length === 1 ? [[0, y(values[0])], [w, y(values[0])]] : values.map((v, i) => [(i / (values.length - 1)) * w, y(v)]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6} ${x2} ${y2}`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-auto h-9 w-32 self-end" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} className={tone.fill} />
      <path d={d} fill="none" strokeWidth="2" strokeLinecap="round" className={tone.stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
