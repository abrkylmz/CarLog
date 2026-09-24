const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

export function formatTL(value: number): string {
  return currency.format(value);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  return number.format(Number(value.toFixed(fractionDigits)));
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
