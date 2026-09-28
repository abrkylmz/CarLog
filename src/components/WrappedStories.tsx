import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Car, Download, Fuel, Pause, Play, RotateCcw, Share2, Sparkles, X } from "lucide-react";
import { CountUp } from "./StatCard";
import { formatNumber, formatTL } from "../lib/format";
import { EARTH_KM, ISTANBUL_ANKARA_KM, type YearSummary } from "../lib/wrapped";

const STORY_MS = 6500;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const dayMonth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

interface Story {
  id: string;
  /** Tailwind gradient classes for the background. */
  bg: string;
  body: React.ReactNode;
}

/**
 * "CarLog Yıl Özeti": full-screen stories in the style of a year-in-review. Tap the right side
 * for the next story and the left side for the previous one, press and hold to pause; each story
 * moves on by itself after a few seconds. The last one sums the year up and can be shared as an
 * image.
 */
export default function WrappedStories({
  summary,
  userName,
  onClose,
}: {
  summary: YearSummary;
  userName: string;
  onClose: () => void;
}) {
  const stories = useMemo(() => buildStories(summary, userName), [summary, userName]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdTimer = useRef<number>();
  const held = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const next = useCallback(() => setIndex((i) => Math.min(stories.length - 1, i + 1)), [stories.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [next, prev, onClose]);

  const last = index === stories.length - 1;
  const story = stories[index];

  // Press and hold pauses; a short tap moves left or right depending on the side.
  const onPointerDown = () => {
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      setPaused(true);
    }, 220);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(holdTimer.current);
    if (held.current) {
      setPaused(false);
      return;
    }
    if ((e.target as HTMLElement).closest("button, a")) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.3) prev();
    else next();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`CarLog ${summary.year} Yıl Özeti`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-6"
    >
      <div
        className={`wrapped-frame relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br text-white transition-[background] duration-700 sm:h-[min(52rem,100%)] sm:max-w-md sm:rounded-[2rem] sm:shadow-2xl ${story.bg}`}
      >
        {/* Progress bars */}
        <div className="relative z-10 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                key={i === index ? `run-${index}` : `idle-${i}`}
                className={`h-full rounded-full bg-white ${i < index ? "w-full" : i > index ? "w-0" : "wrapped-bar"}`}
                style={i === index ? { animationDuration: `${STORY_MS}ms`, animationPlayState: paused || last ? "paused" : "running" } : undefined}
                onAnimationEnd={i === index ? next : undefined}
              />
            </div>
          ))}
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 pt-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">CarLog · {summary.year}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Devam et" : "Duraklat"}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Decorative drifting glow */}
        <div aria-hidden className="wrapped-glow pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />

        <div
          className="relative flex flex-1 select-none flex-col justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => window.clearTimeout(holdTimer.current)}
          aria-live="polite"
        >
          <div key={story.id} className="wrapped-story">
            {story.body}
          </div>
          {last ? (
            <FinalActions summary={summary} userName={userName} onReplay={() => setIndex(0)} />
          ) : (
            <p className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] text-center text-[11px] text-white/60">
              Devam etmek için dokunun · durdurmak için basılı tutun
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="w-item text-sm font-semibold uppercase tracking-[0.16em] text-white/75">{children}</p>;
}

function Big({ children }: { children: React.ReactNode }) {
  return <p className="w-item mt-3 text-6xl font-black leading-none tracking-tight tabular-nums sm:text-7xl">{children}</p>;
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="w-item mt-4 text-lg font-medium leading-snug text-white/90">{children}</p>;
}

function buildStories(s: YearSummary, userName: string): Story[] {
  const stories: Story[] = [];
  const period = s.inProgress ? "Bu yıl şimdiye kadar" : `${s.year} yılında`;

  stories.push({
    id: "intro",
    bg: "from-indigo-600 via-violet-600 to-fuchsia-600",
    body: (
      <>
        <Kicker>CarLog Yıl Özeti</Kicker>
        <p className="w-item mt-2 text-[6.5rem] font-black leading-[0.85] tracking-tighter">{s.year}</p>
        <Line>
          {userName}, {s.inProgress ? "bu yılki" : `${s.year}`} yolculuğuna birlikte bakalım.
        </Line>
        <div className="w-item mt-10 flex items-center gap-2 text-white/70">
          <Sparkles size={18} /> <span className="text-sm">{s.inProgress ? "Yıl henüz bitmedi; şimdiye kadarki özet." : "Yılın tamamı."}</span>
        </div>
      </>
    ),
  });

  if (s.km > 0) {
    const earth = (s.km / EARTH_KM) * 100;
    const trips = s.km / ISTANBUL_ANKARA_KM;
    stories.push({
      id: "km",
      bg: "from-sky-500 via-blue-600 to-indigo-700",
      body: (
        <>
          <Kicker>{period}</Kicker>
          <Big>
            <CountUp to={s.km} format={(n) => formatNumber(n, 0)} />
            <span className="ml-2 text-3xl font-bold">km</span>
          </Big>
          <Line>yol yaptınız.</Line>
          <div className="w-item relative mt-8 h-10">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25" />
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/50" />
            <Car size={28} className="wrapped-drive absolute top-1/2 -translate-y-1/2" />
          </div>
          <Line>
            Bu, dünyanın çevresinin <b>%{formatNumber(earth, earth < 10 ? 1 : 0)}</b> kadarı ya da İstanbul–Ankara arasını{" "}
            <b>{formatNumber(trips, trips < 10 ? 1 : 0)} kez</b> gitmek demek.
          </Line>
        </>
      ),
    });
  }

  if (s.liters > 0) {
    stories.push({
      id: "fuel",
      bg: "from-amber-400 via-orange-500 to-rose-600",
      body: (
        <>
          <Kicker>Yakıt</Kicker>
          <Big>
            <CountUp to={s.liters} format={(n) => formatNumber(n, 0)} />
            <span className="ml-2 text-3xl font-bold">L</span>
          </Big>
          <Line>
            yakıt aldınız: <b>{s.fillCount} dolum</b>, yaklaşık <b>{formatNumber(s.tanks, 0)} tam depo</b>.
          </Line>
          <div className="w-item mt-8 flex items-end gap-4">
            <div className="relative h-32 w-16 overflow-hidden rounded-2xl border-2 border-white/70 bg-white/10">
              <div className="wrapped-fill absolute inset-x-0 bottom-0 bg-white/80" style={{ height: "100%" }} />
            </div>
            <Fuel size={40} className="mb-1 text-white/85" />
          </div>
        </>
      ),
    });
  }

  if (s.total > 0) {
    const fuelShare = s.total > 0 ? (s.fuelCost / s.total) * 100 : 0;
    stories.push({
      id: "spend",
      bg: "from-emerald-500 via-teal-600 to-cyan-800",
      body: (
        <>
          <Kicker>Toplam harcama</Kicker>
          <Big>
            <CountUp to={s.total} format={(n) => formatTL(n).replace(/,\d\d$/, "")} />
          </Big>
          <Line>
            Günde ortalama <b>{formatTL(s.perDay)}</b>.
          </Line>
          <div className="w-item mt-8 flex flex-col gap-3 text-sm">
            <ShareBar label="Yakıt" value={s.fuelCost} percent={fuelShare} />
            <ShareBar label="Diğer masraflar" value={s.otherCost} percent={100 - fuelShare} delay={180} />
          </div>
        </>
      ),
    });
  }

  if (s.busiestMonth) {
    const max = Math.max(...s.months);
    stories.push({
      id: "month",
      bg: "from-rose-500 via-pink-600 to-purple-700",
      body: (
        <>
          <Kicker>En yoğun ay</Kicker>
          <Big>{MONTHS[s.busiestMonth.index]}</Big>
          <Line>
            O ay yakıt ve masraflara <b>{formatTL(s.busiestMonth.total)}</b> harcadınız.
          </Line>
          <div className="w-item mt-8 flex h-28 items-end gap-1.5">
            {s.months.map((value, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex w-full flex-1 items-end">
                <div
                  className={`wrapped-bar-up w-full rounded-t-md ${i === s.busiestMonth!.index ? "bg-white" : "bg-white/35"}`}
                  style={{ height: `${max > 0 ? Math.max(4, (value / max) * 100) : 4}%`, animationDelay: `${300 + i * 45}ms` }}
                />
                </div>
                <span className="text-[9px] text-white/70">{MONTHS[i].slice(0, 1)}</span>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }

  if (s.mostEfficient || s.cheapestFill) {
    stories.push({
      id: "best",
      bg: "from-cyan-500 via-sky-600 to-blue-800",
      body: (
        <>
          <Kicker>En iyiler</Kicker>
          {s.mostEfficient ? (
            <>
              <Big>
                <CountUp to={s.mostEfficient.per100km} format={(n) => formatNumber(n, 1)} />
                <span className="ml-2 text-3xl font-bold">L/100km</span>
              </Big>
              <Line>
                <b>{s.mostEfficient.vehicle}</b> yılın en verimli aracı oldu.
              </Line>
            </>
          ) : null}
          {s.cheapestFill ? (
            <div className="w-item mt-8 rounded-2xl bg-white/15 p-4 ring-1 ring-white/25">
              <p className="text-xs uppercase tracking-[0.14em] text-white/70">En ucuz yakıt</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(s.cheapestFill.price, 2)} TL/L</p>
              <p className="text-sm text-white/80">
                {dayMonth(s.cheapestFill.date)} · {s.cheapestFill.vehicle}
              </p>
            </div>
          ) : null}
        </>
      ),
    });
  }

  if (s.topVehicle || s.topCategory) {
    stories.push({
      id: "top",
      bg: "from-violet-600 via-purple-700 to-slate-900",
      body: (
        <>
          <Kicker>Öne çıkanlar</Kicker>
          {s.topVehicle ? (
            <>
              <Big>{s.topVehicle.name}</Big>
              <Line>
                en çok kullandığınız araç: <b>{formatNumber(s.topVehicle.km, 0)} km</b>.
              </Line>
            </>
          ) : null}
          {s.topCategory ? (
            <div className="w-item mt-8 rounded-2xl bg-white/15 p-4 ring-1 ring-white/25">
              <p className="text-xs uppercase tracking-[0.14em] text-white/70">En büyük masraf kalemi</p>
              <p className="mt-1 text-2xl font-bold">{s.topCategory.label}</p>
              <p className="text-sm text-white/80">{formatTL(s.topCategory.total)}</p>
            </div>
          ) : null}
        </>
      ),
    });
  }

  stories.push({
    id: "final",
    bg: "from-slate-900 via-indigo-950 to-violet-900",
    body: (
      <>
        <Kicker>{s.year} özetiniz</Kicker>
        <div className="w-item mt-5 grid grid-cols-2 gap-3">
          <SummaryTile label="Yol" value={`${formatNumber(s.km, 0)} km`} />
          <SummaryTile label="Yakıt" value={`${formatNumber(s.liters, 0)} L`} />
          <SummaryTile label="Harcama" value={formatTL(s.total).replace(/,\d\d$/, "")} />
          <SummaryTile label="Dolum" value={String(s.fillCount)} />
          {s.busiestMonth ? <SummaryTile label="En yoğun ay" value={MONTHS[s.busiestMonth.index]} /> : null}
          {s.mostEfficient ? <SummaryTile label="En verimli" value={`${formatNumber(s.mostEfficient.per100km, 1)} L`} /> : null}
        </div>
      </>
    ),
  });

  return stories;
}

function ShareBar({ label, value, percent, delay = 0 }: { label: string; value: number; percent: number; delay?: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {formatTL(value)} · %{Math.round(percent)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
        <div className="grow-x h-full rounded-full bg-white" style={{ width: `${Math.max(2, percent)}%`, animationDelay: `${400 + delay}ms` }} />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FinalActions({ summary, userName, onReplay }: { summary: YearSummary; userName: string; onReplay: () => void }) {
  const [busy, setBusy] = useState(false);
  const canShareFiles = typeof navigator !== "undefined" && "canShare" in navigator;

  async function share() {
    setBusy(true);
    try {
      const blob = await renderShareImage(summary, userName);
      const file = new File([blob], `carlog-${summary.year}.png`, { type: "image/png" });
      const download = () => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `CarLog ${summary.year}` });
        } catch (err) {
          // Closing the share sheet is fine; any other failure falls back to a download.
          if ((err as DOMException).name !== "AbortError") download();
        }
      } else {
        download();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-item mt-8 flex gap-3" style={{ animationDelay: "600ms" }}>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-white/90 disabled:opacity-60"
      >
        {canShareFiles ? <Share2 size={18} /> : <Download size={18} />}
        {busy ? "Hazırlanıyor…" : canShareFiles ? "Paylaş" : "Görseli indir"}
      </button>
      <button
        type="button"
        onClick={onReplay}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-semibold ring-1 ring-white/25 transition hover:bg-white/25"
      >
        <RotateCcw size={16} />
        Baştan
      </button>
    </div>
  );
}

/** Draws the year summary as a 1080×1920 story image for sharing. */
async function renderShareImage(s: YearSummary, userName: string): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#4f46e5");
  bg.addColorStop(0.55, "#7c3aed");
  bg.addColorStop(1, "#c026d3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.2, 0, W * 0.85, H * 0.2, 520);
  glow.addColorStop(0, "rgba(255,255,255,0.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = font(700, 40);
  ctx.fillText("CARLOG YIL ÖZETİ", 90, 190);
  ctx.fillStyle = "#fff";
  ctx.font = font(900, 300);
  ctx.fillText(String(s.year), 70, 480);
  ctx.font = font(500, 46);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`${userName}${s.inProgress ? " · şimdiye kadar" : ""}`, 90, 570);

  const tiles: [string, string][] = [
    ["YOL", `${formatNumber(s.km, 0)} km`],
    ["YAKIT", `${formatNumber(s.liters, 0)} L`],
    ["HARCAMA", formatTL(s.total).replace(/,\d\d$/, "")],
    ["DOLUM", String(s.fillCount)],
    ["EN YOĞUN AY", s.busiestMonth ? MONTHS[s.busiestMonth.index] : "—"],
    ["EN VERİMLİ", s.mostEfficient ? `${formatNumber(s.mostEfficient.per100km, 1)} L/100km` : "—"],
  ];
  const tileW = (W - 90 * 2 - 40) / 2;
  const tileH = 250;
  tiles.forEach(([label, value], i) => {
    const x = 90 + (i % 2) * (tileW + 40);
    const y = 700 + Math.floor(i / 2) * (tileH + 40);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, x, y, tileW, tileH, 40);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = font(700, 32);
    ctx.fillText(label, x + 44, y + 80);
    ctx.fillStyle = "#fff";
    let size = 76;
    ctx.font = font(800, size);
    while (ctx.measureText(value).width > tileW - 88 && size > 36) {
      size -= 4;
      ctx.font = font(800, size);
    }
    ctx.fillText(value, x + 44, y + 185);
  });

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = font(600, 38);
  ctx.fillText("Yakıt ve masraflarını CarLog ile takip et", 90, H - 150);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
