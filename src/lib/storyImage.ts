// The year summary as a 1080×1920 story image (Instagram, WhatsApp status). Key content stays
// out of the top and bottom 220 px, where the apps put their own bars.
import { EARTH_KM, ISTANBUL_ANKARA_KM, type YearSummary } from "./wrapped";
import { formatNumber, formatTL } from "./format";

const W = 1080;
const H = 1920;
const X = 90;
const FAMILY = `"Plus Jakarta Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
const font = (weight: number, size: number) => `${weight} ${size}px ${FAMILY}`;
const MONTH_INITIALS = ["O", "Ş", "M", "N", "M", "H", "T", "A", "E", "E", "K", "A"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const tl = (n: number) => formatTL(n).replace(/,\d\d$/, "");
/** Same colors as the charts in the app: fuel in the brand color, other costs orange. */
const ORANGE = "#f97316";
const AMBER = "#fbbf24";

/** The brand color as the app currently shows it (it follows the chosen accent). */
function brand(shade: number, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--brand-${shade}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : fallback;
}

export async function renderStoryImage(s: YearSummary, userName: string): Promise<Blob> {
  // The canvas only uses a web font that has been loaded.
  try {
    await Promise.all([400, 600, 700, 800].map((w) => document.fonts.load(font(w, 40), "₺ÇĞİÖŞÜçğıöşü0123")));
  } catch {
    // Falls back to the system font.
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const fuelColor = brand(400, "#60a5fa");

  drawBackdrop(ctx);

  // ---- header: wordmark and the year pill
  let y = 236;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = font(800, 54);
  ctx.fillText("CarLog", X, y);
  const pill = `YIL ÖZETİ · ${s.year}`;
  ctx.font = font(700, 30);
  const pw = ctx.measureText(pill).width + 56;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(ctx, W - X - pw, y - 46, pw, 62, 31);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(pill, W - X - pw + 28, y - 4);

  // ---- the headline: what the year cost
  y = 370;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = font(600, 40);
  ctx.fillText(`${userName}, ${s.year}${s.inProgress ? " boyunca şimdiye kadar" : " boyunca"}`, X, y);
  y += 172;
  ctx.fillStyle = "#fff";
  fitText(ctx, tl(s.total), 800, 172, W - 2 * X);
  ctx.fillText(tl(s.total), X - 6, y);
  y += 64;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = font(600, 40);
  ctx.fillText(s.vehicleCount > 1 ? `${s.vehicleCount} araca harcadın` : "arabana harcadın", X, y);

  // ---- fuel vs other, as one split bar
  y += 50;
  const share = s.total > 0 ? s.fuelCost / s.total : 1;
  const barW = W - 2 * X;
  ctx.save();
  roundRect(ctx, X, y, barW, 28, 14);
  ctx.clip();
  ctx.fillStyle = fuelColor;
  ctx.fillRect(X, y, barW * share, 28);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(X + barW * share, y, barW * (1 - share), 28);
  ctx.restore();
  y += 74;
  legend(ctx, X, y, fuelColor, "Yakıt", `${tl(s.fuelCost)} · %${Math.round(share * 100)}`);
  if (s.otherCost > 0) legend(ctx, X + barW / 2 + 20, y, ORANGE, "Diğer", `${tl(s.otherCost)} · %${100 - Math.round(share * 100)}`);

  // ---- the year month by month, the busiest month called out
  y += 84;
  const chartH = 200;
  const max = Math.max(...s.months, 1);
  const slot = barW / 12;
  const busiest = s.busiestMonth?.index ?? -1;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, X - 30, y - 24, barW + 60, chartH + 136, 40);
  ctx.fill();
  s.months.forEach((v, i) => {
    const h = v > 0 ? Math.max(10, (v / max) * (chartH - 60)) : 6;
    const bx = X + i * slot + slot * 0.2;
    const by = y + chartH - h;
    ctx.fillStyle = i === busiest ? AMBER : v > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)";
    roundRect(ctx, bx, by, slot * 0.6, h, 10);
    ctx.fill();
    ctx.fillStyle = i === busiest ? AMBER : "rgba(255,255,255,0.6)";
    ctx.font = font(700, 26);
    ctx.textAlign = "center";
    ctx.fillText(MONTH_INITIALS[i], bx + slot * 0.3, y + chartH + 44);
    if (i === busiest) {
      ctx.font = font(800, 28);
      ctx.fillText(tl(v), clamp(bx + slot * 0.3, X + 70, W - X - 70), by - 18);
    }
    ctx.textAlign = "left";
  });
  if (s.busiestMonth) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = font(600, 28);
    ctx.fillText(`En yoğun ay ${MONTHS[s.busiestMonth.index]}`, X, y + chartH + 88);
  }

  // ---- four figures
  y += chartH + 156;
  const tiles: [string, string, string | null][] = [
    ["Yol", `${formatNumber(s.km, 0)} km`, null],
    ["Yakıt", `${formatNumber(s.liters, 0)} L`, s.tanks >= 1 ? `${formatNumber(s.tanks, 0)} depo` : null],
    ["Dolum", String(s.fillCount), s.fillCount > 0 ? `ortalama ${formatNumber(s.liters / s.fillCount, 0)} L` : null],
    ["En verimli", s.mostEfficient ? `${formatNumber(s.mostEfficient.per100km, 1)} L` : "—", s.mostEfficient ? `100 km · ${s.mostEfficient.vehicle}` : null],
  ];
  const tileW = (barW - 30) / 2;
  const tileH = 166;
  tiles.forEach(([label, value, note], i) => {
    const tx = X + (i % 2) * (tileW + 30);
    const ty = y + Math.floor(i / 2) * (tileH + 24);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, tx, ty, tileW, tileH, 36);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = font(700, 28);
    ctx.fillText(label.toLocaleUpperCase("tr"), tx + 36, ty + 50);
    ctx.fillStyle = "#fff";
    fitText(ctx, value, 800, 58, tileW - 72);
    ctx.fillText(value, tx + 34, ty + 112);
    if (note) {
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      fitText(ctx, note, 600, 26, tileW - 72);
      ctx.fillText(note, tx + 36, ty + 146);
    }
  });

  // ---- one fun comparison
  y += 2 * tileH + 24 + 84;
  const fact = funFact(s.km);
  if (fact) {
    ctx.fillStyle = AMBER;
    ctx.font = font(800, 40);
    ctx.fillText(fact[0], X, y);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = font(600, 34);
    ctx.fillText(fact[1], X, y + 50);
  }

  // ---- footer, above the reply bar
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = font(600, 28);
  ctx.textAlign = "center";
  ctx.fillText(`Yakıtını ve masraflarını takip et · ${location.host}`, W / 2, 1745);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}

/** Night sky over the road: the same evening look as the home screen's hero. */
function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, brand(900, "#1e1b4b"));
  bg.addColorStop(0.6, brand(700, "#3730a3"));
  bg.addColorStop(1, brand(500, "#4f46e5"));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(2,6,23,0.35)";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.8, H * 0.93, 0, W * 0.8, H * 0.93, 700);
  glow.addColorStop(0, "rgba(251,191,36,0.45)");
  glow.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, 600);
  top.addColorStop(0, "rgba(255,255,255,0.12)");
  top.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);

  // A few stars, always in the same places.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * 380, rand() * 2.2 + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hills and the road at the bottom.
  const hills = (points: number[], color: string) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    points.forEach((py, i) => ctx.lineTo((i / (points.length - 1)) * W, py));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  hills([1740, 1690, 1715, 1660, 1705, 1675, 1720, 1680, 1700], "rgba(255,255,255,0.06)");
  hills([1800, 1770, 1790, 1760, 1795, 1770, 1785], "rgba(2,6,23,0.3)");
  ctx.fillStyle = "rgba(2,6,23,0.45)";
  ctx.fillRect(0, 1840, W, H - 1840);
  ctx.strokeStyle = "rgba(251,191,36,0.6)";
  ctx.lineWidth = 6;
  ctx.setLineDash([46, 34]);
  ctx.beginPath();
  ctx.moveTo(0, 1880);
  ctx.lineTo(W, 1880);
  ctx.stroke();
  ctx.setLineDash([]);
}

function legend(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string, value: string) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y - 24, 26, 26, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = font(600, 30);
  ctx.fillText(label, x + 42, y);
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = "#fff";
  ctx.font = font(800, 30);
  ctx.fillText(value, x + 42 + lw + 14, y);
}

/** "Dünyanın çevresinin %27'si" or "İstanbul–Ankara'yı 6 kez". */
function funFact(km: number): [string, string] | null {
  if (km >= EARTH_KM * 0.05) return [`Dünyanın çevresinin %${Math.round((km / EARTH_KM) * 100)}'i`, "kadar yol yaptın"];
  const times = Math.floor(km / ISTANBUL_ANKARA_KM);
  if (times >= 1) return [`İstanbul–Ankara'yı ${times} kez`, "gidecek kadar yol yaptın"];
  return null;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) {
  ctx.font = font(weight, size);
  while (ctx.measureText(text).width > max && size > 20) {
    size -= 4;
    ctx.font = font(weight, size);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
