// Subscription plans, shared by the server (limits) and the app (pricing page, prompts).
// Change prices, limits or what each plan includes here; nothing else needs to know the numbers.
//
// For now this is a preview: there is no payment provider yet, so choosing a plan activates it
// without charging (see PLAN_PREVIEW). Only the vehicle limit is enforced; features marked
// `soon` are listed on the pricing page but don't exist yet. To make a feature paid later, add a
// key to Feature, set it per plan, and check it with planHasFeature on both server and client.

export type PlanId = "free" | "plus" | "pro" | "fleet";

export type Feature =
  | "records" // fill-ups, expenses, reminders
  | "analysis" // consumption, monthly reports, insights, year in review
  | "notifications"
  | "sharing"
  | "export" // Excel/CSV
  | "pdfReports"
  | "receiptScan"
  | "fleetReports"
  | "prioritySupport";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** TL per month; the yearly price is 10 months' worth (2 months free). */
  monthlyPrice: number;
  /** Vehicles the user may own (vehicles shared with them don't count). */
  maxVehicles: number;
  features: Feature[];
  highlight?: boolean;
}

/** True while there is no payment provider: plans switch on for free, and the UI says so. */
export const PLAN_PREVIEW = true;

const BASE: Feature[] = ["records", "analysis", "notifications", "sharing", "export"];

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Ücretsiz",
    tagline: "Kendi aracını takip edenler için",
    monthlyPrice: 0,
    maxVehicles: 2,
    features: BASE,
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Ailenin araçları tek yerde",
    monthlyPrice: 49,
    maxVehicles: 5,
    features: [...BASE, "pdfReports"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Çok araçlı evler ve küçük işletmeler",
    monthlyPrice: 99,
    maxVehicles: 10,
    features: [...BASE, "pdfReports", "receiptScan"],
    highlight: true,
  },
  {
    id: "fleet",
    name: "Filo",
    tagline: "Şirket araçları ve filolar",
    monthlyPrice: 249,
    maxVehicles: 50,
    features: [...BASE, "pdfReports", "receiptScan", "fleetReports", "prioritySupport"],
  },
];

/** What the pricing page says for each feature; `soon`: announced, not built yet. */
export const FEATURE_INFO: Record<Feature, { label: string; soon?: boolean }> = {
  records: { label: "Dolum, masraf ve hatırlatma kaydı" },
  analysis: { label: "Tüketim analizi, aylık rapor ve Yıl Özeti" },
  notifications: { label: "Hatırlatma bildirimleri" },
  sharing: { label: "Aracı aile veya iş arkadaşlarıyla paylaşma" },
  export: { label: "Excel'e aktarma" },
  pdfReports: { label: "PDF rapor" },
  receiptScan: { label: "Fiş fotoğrafından otomatik dolum", soon: true },
  fleetReports: { label: "Filo raporları ve sürücü bazlı dökümler", soon: true },
  prioritySupport: { label: "Öncelikli destek", soon: true },
};

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function planHasFeature(id: string | null | undefined, feature: Feature): boolean {
  return planById(id).features.includes(feature);
}

/** Admins have every feature and no vehicle limit, whatever plan their account is on. */
export function userHasFeature(user: { role: string; plan: string | null | undefined }, feature: Feature): boolean {
  return user.role === "admin" || planHasFeature(user.plan, feature);
}

/** How many vehicles the user may own: their plan's limit, unlimited for admins. */
export function vehicleLimit(user: { role: string; plan: string | null | undefined }): number {
  return user.role === "admin" ? Infinity : planById(user.plan).maxVehicles;
}

/** The cheapest plan that includes `feature`. */
export function planForFeature(feature: Feature): Plan {
  return PLANS.find((p) => p.features.includes(feature)) ?? PLANS[PLANS.length - 1];
}

/** The cheapest plan that allows `count` owned vehicles. */
export function planForVehicles(count: number): Plan {
  return PLANS.find((p) => p.maxVehicles >= count) ?? PLANS[PLANS.length - 1];
}
