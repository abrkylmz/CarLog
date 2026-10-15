// Body styles for the vehicle drawings. A vehicle can have one set by hand; otherwise it's guessed
// from the make and model, which covers the catalog's common Turkish models.

export type BodyType = "sedan" | "hatchback" | "suv" | "station" | "van";

export const BODY_TYPES: BodyType[] = ["sedan", "hatchback", "suv", "station", "van"];

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  sedan: "Sedan",
  hatchback: "Hatchback",
  suv: "SUV / Crossover",
  station: "Station wagon",
  van: "Hafif ticari",
};

const fold = (t: string) => t.toLocaleLowerCase("tr-TR");

// Words in the model (or version) name that give the body style away, checked in this order.
const RULES: [BodyType, string[]][] = [
  ["van", ["doblo", "fiorino", "kangoo", "caddy", "berlingo", "partner", "combo", "courier", "connect", "transit", "rifter", "tourneo", "nemo", "bipper", "express", "citan", "dokker", "transporter", "vito", "jumpy", "expert", "boxer", "ducato"]],
  ["station", ["station", " sw", "variant", "estate", "combi", "touring", "sports tourer", "jogger", "kombi", "grandtour", "avant"]],
  ["suv", ["suv", "cross", "duster", "tucson", "qashqai", "juke", "c-hr", "chr", "rav4", "3008", "2008", "5008", "kuga", "puma", "ecosport", "sportage", "stonic", "niro", "t-roc", "tiguan", "t-cross", "taigo", "captur", "kadjar", "austral", "koleos", "x1", "x3", "x5", "q2", "q3", "q5", "gla", "glc", "kona", "bayon", "ix35", "santa fe", "karoq", "kodiaq", "kamiq", "ateca", "arona", "tarraco", "formentor", "mokka", "crossland", "grandland", "c3 aircross", "c5 aircross", "togg", "t10x", "tiggo", "atto 3", "seal u", "mg zs", "x-trail", "vitara", "jimny", "s-cross", "compass", "renegade", "range rover", "evoque", "xc40", "xc60", "xc90", "model y"]],
  ["sedan", ["sedan", "symbol", "linea", "taliant", "albea", "fluence", "passat", "jetta", "octavia", "superb", "c-elysee", "elysee", "301", "accent", "elantra", "civic sedan", "city", "corolla", "camry", "3 serisi", "5 serisi", "c serisi", "e serisi", "a4", "a6", "c-class", "e-class", "insignia", "vectra", "mondeo", "laguna", "megane sedan", "focus sedan", "cerato", "sentra", "model 3"]],
];

/** The body style to draw: the one set on the vehicle, else a guess from make and model. */
export function bodyTypeOf(vehicle: { bodyType?: BodyType; brand?: string; model?: string; name?: string }): BodyType {
  if (vehicle.bodyType) return vehicle.bodyType;
  return guessBodyType([vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.name || "");
}

export function guessBodyType(text: string): BodyType {
  const t = ` ${fold(text)} `;
  for (const [type, words] of RULES) {
    if (words.some((w) => t.includes(w))) return type;
  }
  return "hatchback";
}
