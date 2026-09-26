// Starter vehicle catalog: the most common models on Turkish roads, with factory fuel tank sizes.
// Values come from the manufacturers' technical data as published per generation/engine on
// auto-data.net (checked September 2026); figures that disagreed between sources were
// cross-checked and noted. Admins extend or correct the catalog from the admin panel.
//
// Bump CATALOG_SEED_VERSION when adding rows here: rows are inserted once per version, so
// admin edits aren't overwritten, but a row an admin deleted comes back after a bump.
import type { CatalogEntry } from "../src/types.ts";

export const CATALOG_SEED_VERSION = 1;

type Seed = Omit<CatalogEntry, "yearTo" | "lpgTankCapacity" | "note"> & {
  yearTo?: number;
  lpgTankCapacity?: number;
  note?: string;
};

const BD: CatalogEntry["fuelTypes"] = ["benzin", "dizel"];

export const CATALOG_SEED: Seed[] = [
  // Renault
  { id: "renault-clio-4", brand: "Renault", model: "Clio", generation: "IV", yearFrom: 2012, yearTo: 2019, fuelTypes: BD, tankCapacity: 45 },
  { id: "renault-clio-5", brand: "Renault", model: "Clio", generation: "V", yearFrom: 2019, fuelTypes: BD, tankCapacity: 42 },
  { id: "renault-clio-5-hybrid", brand: "Renault", model: "Clio", generation: "V E-Tech Hibrit", yearFrom: 2020, fuelTypes: ["hibrit"], tankCapacity: 39 },
  { id: "renault-clio-5-lpg", brand: "Renault", model: "Clio", generation: "V LPG (fabrika)", yearFrom: 2019, fuelTypes: ["benzin-lpg"], tankCapacity: 39, lpgTankCapacity: 32 },
  { id: "renault-megane-4-sedan", brand: "Renault", model: "Megane Sedan", generation: "IV", yearFrom: 2016, fuelTypes: BD, tankCapacity: 50, note: "Kaynaklarda 49–49,7 L olarak da geçer." },
  { id: "renault-taliant", brand: "Renault", model: "Taliant", generation: "I", yearFrom: 2021, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "renault-symbol-3", brand: "Renault", model: "Symbol", generation: "III", yearFrom: 2013, yearTo: 2020, fuelTypes: BD, tankCapacity: 50 },
  { id: "renault-fluence", brand: "Renault", model: "Fluence", generation: "I", yearFrom: 2010, yearTo: 2016, fuelTypes: BD, tankCapacity: 60 },
  { id: "renault-captur-2", brand: "Renault", model: "Captur", generation: "II", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 48 },
  { id: "renault-austral", brand: "Renault", model: "Austral", generation: "I", yearFrom: 2022, fuelTypes: ["benzin", "hibrit"], tankCapacity: 55 },
  // Fiat
  { id: "fiat-egea-sedan", brand: "Fiat", model: "Egea Sedan", generation: "356", yearFrom: 2015, fuelTypes: BD, tankCapacity: 50 },
  { id: "fiat-egea-hatchback", brand: "Fiat", model: "Egea Hatchback", generation: "357", yearFrom: 2016, fuelTypes: BD, tankCapacity: 50 },
  { id: "fiat-egea-cross", brand: "Fiat", model: "Egea Cross", generation: "I", yearFrom: 2020, fuelTypes: BD, tankCapacity: 50 },
  { id: "fiat-linea", brand: "Fiat", model: "Linea", generation: "I", yearFrom: 2007, yearTo: 2016, fuelTypes: BD, tankCapacity: 45 },
  { id: "fiat-doblo-2", brand: "Fiat", model: "Doblo", generation: "II", yearFrom: 2010, yearTo: 2022, fuelTypes: BD, tankCapacity: 60 },
  // Toyota
  { id: "toyota-corolla-e170", brand: "Toyota", model: "Corolla", generation: "E170", yearFrom: 2013, yearTo: 2018, fuelTypes: BD, tankCapacity: 55 },
  { id: "toyota-corolla-e210", brand: "Toyota", model: "Corolla", generation: "E210", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "toyota-corolla-e210-hybrid", brand: "Toyota", model: "Corolla", generation: "E210 Hibrit (1.8)", yearFrom: 2019, fuelTypes: ["hibrit"], tankCapacity: 43 },
  { id: "toyota-chr-1", brand: "Toyota", model: "C-HR", generation: "I Hibrit", yearFrom: 2016, yearTo: 2023, fuelTypes: ["hibrit"], tankCapacity: 43 },
  { id: "toyota-chr-2", brand: "Toyota", model: "C-HR", generation: "II Hibrit", yearFrom: 2023, fuelTypes: ["hibrit"], tankCapacity: 43 },
  { id: "toyota-yaris-4", brand: "Toyota", model: "Yaris", generation: "IV Hibrit", yearFrom: 2020, fuelTypes: ["hibrit"], tankCapacity: 36 },
  // Dacia
  { id: "dacia-sandero-3", brand: "Dacia", model: "Sandero / Stepway", generation: "III", yearFrom: 2020, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "dacia-sandero-3-lpg", brand: "Dacia", model: "Sandero / Stepway", generation: "III ECO-G (LPG)", yearFrom: 2020, fuelTypes: ["benzin-lpg"], tankCapacity: 50, lpgTankCapacity: 40 },
  { id: "dacia-duster-2", brand: "Dacia", model: "Duster", generation: "II", yearFrom: 2018, yearTo: 2024, fuelTypes: BD, tankCapacity: 50 },
  { id: "dacia-duster-3", brand: "Dacia", model: "Duster", generation: "III", yearFrom: 2024, fuelTypes: ["benzin", "hibrit"], tankCapacity: 50 },
  { id: "dacia-jogger", brand: "Dacia", model: "Jogger", generation: "I", yearFrom: 2022, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "dacia-jogger-lpg", brand: "Dacia", model: "Jogger", generation: "I ECO-G (LPG)", yearFrom: 2022, fuelTypes: ["benzin-lpg"], tankCapacity: 50, lpgTankCapacity: 40 },
  // Hyundai
  { id: "hyundai-i10-3", brand: "Hyundai", model: "i10", generation: "III", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 36 },
  { id: "hyundai-i20-3", brand: "Hyundai", model: "i20", generation: "III", yearFrom: 2020, fuelTypes: ["benzin"], tankCapacity: 40 },
  { id: "hyundai-accent-blue", brand: "Hyundai", model: "Accent Blue", generation: "RB", yearFrom: 2011, yearTo: 2018, fuelTypes: BD, tankCapacity: 43 },
  { id: "hyundai-bayon", brand: "Hyundai", model: "Bayon", generation: "I", yearFrom: 2021, fuelTypes: ["benzin"], tankCapacity: 40 },
  { id: "hyundai-tucson-4", brand: "Hyundai", model: "Tucson", generation: "IV", yearFrom: 2020, fuelTypes: BD, tankCapacity: 54 },
  { id: "hyundai-tucson-4-hybrid", brand: "Hyundai", model: "Tucson", generation: "IV Hibrit", yearFrom: 2020, fuelTypes: ["hibrit"], tankCapacity: 52 },
  // Peugeot
  { id: "peugeot-208-2", brand: "Peugeot", model: "208", generation: "II", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 44, note: "Bir kaynakta 40 L olarak geçer; iki kaynak 44 L diyor." },
  { id: "peugeot-301", brand: "Peugeot", model: "301", generation: "I", yearFrom: 2012, yearTo: 2022, fuelTypes: BD, tankCapacity: 50 },
  { id: "peugeot-2008-2", brand: "Peugeot", model: "2008", generation: "II", yearFrom: 2019, fuelTypes: BD, tankCapacity: 44 },
  { id: "peugeot-3008-2", brand: "Peugeot", model: "3008", generation: "II", yearFrom: 2016, yearTo: 2023, fuelTypes: BD, tankCapacity: 53 },
  // Citroën
  { id: "citroen-c-elysee", brand: "Citroën", model: "C-Elysée", generation: "II", yearFrom: 2012, yearTo: 2022, fuelTypes: BD, tankCapacity: 50 },
  { id: "citroen-c3-3", brand: "Citroën", model: "C3", generation: "III", yearFrom: 2016, yearTo: 2024, fuelTypes: BD, tankCapacity: 45 },
  { id: "citroen-c4-3", brand: "Citroën", model: "C4", generation: "III", yearFrom: 2020, fuelTypes: BD, tankCapacity: 50 },
  // Opel
  { id: "opel-corsa-f", brand: "Opel", model: "Corsa", generation: "F", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 44 },
  { id: "opel-astra-k", brand: "Opel", model: "Astra", generation: "K", yearFrom: 2015, yearTo: 2021, fuelTypes: BD, tankCapacity: 48 },
  { id: "opel-astra-l", brand: "Opel", model: "Astra", generation: "L", yearFrom: 2021, fuelTypes: ["benzin"], tankCapacity: 52 },
  // Volkswagen
  { id: "vw-polo-6", brand: "Volkswagen", model: "Polo", generation: "VI", yearFrom: 2017, fuelTypes: ["benzin"], tankCapacity: 40 },
  { id: "vw-golf-7", brand: "Volkswagen", model: "Golf", generation: "VII", yearFrom: 2012, yearTo: 2019, fuelTypes: BD, tankCapacity: 50 },
  { id: "vw-golf-8", brand: "Volkswagen", model: "Golf", generation: "VIII", yearFrom: 2020, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "vw-passat-b8", brand: "Volkswagen", model: "Passat", generation: "B8", yearFrom: 2014, yearTo: 2023, fuelTypes: BD, tankCapacity: 66 },
  { id: "vw-t-roc", brand: "Volkswagen", model: "T-Roc", generation: "I", yearFrom: 2017, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "vw-tiguan-2", brand: "Volkswagen", model: "Tiguan", generation: "II", yearFrom: 2016, yearTo: 2024, fuelTypes: BD, tankCapacity: 58 },
  // Ford
  { id: "ford-focus-3", brand: "Ford", model: "Focus", generation: "III", yearFrom: 2011, yearTo: 2018, fuelTypes: BD, tankCapacity: 55 },
  { id: "ford-focus-4", brand: "Ford", model: "Focus", generation: "IV", yearFrom: 2018, fuelTypes: BD, tankCapacity: 47 },
  { id: "ford-puma", brand: "Ford", model: "Puma", generation: "I", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 42 },
  { id: "ford-kuga-3", brand: "Ford", model: "Kuga", generation: "III", yearFrom: 2019, fuelTypes: BD, tankCapacity: 54 },
  // Skoda
  { id: "skoda-octavia-3", brand: "Skoda", model: "Octavia", generation: "III", yearFrom: 2013, yearTo: 2020, fuelTypes: BD, tankCapacity: 50 },
  { id: "skoda-octavia-4", brand: "Skoda", model: "Octavia", generation: "IV", yearFrom: 2020, fuelTypes: BD, tankCapacity: 45 },
  { id: "skoda-superb-3", brand: "Skoda", model: "Superb", generation: "III", yearFrom: 2015, yearTo: 2023, fuelTypes: BD, tankCapacity: 66 },
  // Honda
  { id: "honda-civic-10", brand: "Honda", model: "Civic", generation: "X", yearFrom: 2016, yearTo: 2021, fuelTypes: ["benzin"], tankCapacity: 47 },
  { id: "honda-civic-11", brand: "Honda", model: "Civic", generation: "XI", yearFrom: 2021, fuelTypes: ["benzin"], tankCapacity: 47 },
  // Nissan
  { id: "nissan-qashqai-j11", brand: "Nissan", model: "Qashqai", generation: "II (J11)", yearFrom: 2014, yearTo: 2021, fuelTypes: BD, tankCapacity: 55 },
  { id: "nissan-qashqai-j12", brand: "Nissan", model: "Qashqai", generation: "III (J12)", yearFrom: 2021, fuelTypes: ["benzin"], tankCapacity: 55 },
  { id: "nissan-juke-2", brand: "Nissan", model: "Juke", generation: "II", yearFrom: 2019, fuelTypes: ["benzin"], tankCapacity: 46 },
  // Kia
  { id: "kia-sportage-5", brand: "Kia", model: "Sportage", generation: "V", yearFrom: 2021, fuelTypes: BD, tankCapacity: 54 },
  { id: "kia-sportage-5-hybrid", brand: "Kia", model: "Sportage", generation: "V Hibrit", yearFrom: 2021, fuelTypes: ["hibrit"], tankCapacity: 52 },
  // Seat
  { id: "seat-leon-4", brand: "Seat", model: "Leon", generation: "IV", yearFrom: 2020, fuelTypes: ["benzin"], tankCapacity: 50 },
  // BMW
  { id: "bmw-1-f20", brand: "BMW", model: "1 Serisi", generation: "F20", yearFrom: 2011, yearTo: 2019, fuelTypes: BD, tankCapacity: 52 },
  { id: "bmw-3-g20", brand: "BMW", model: "3 Serisi", generation: "G20", yearFrom: 2019, fuelTypes: BD, tankCapacity: 59 },
  // Mercedes-Benz
  { id: "mercedes-c-w205", brand: "Mercedes-Benz", model: "C Serisi", generation: "W205", yearFrom: 2014, yearTo: 2021, fuelTypes: BD, tankCapacity: 41, note: "Standart depo 41 L; opsiyonel 66 L depoyla da satıldı. Aracınızı kontrol edin." },
  { id: "mercedes-c-w206", brand: "Mercedes-Benz", model: "C Serisi", generation: "W206", yearFrom: 2021, fuelTypes: BD, tankCapacity: 50, note: "Opsiyonel büyük depoyla satılmış olabilir." },
  // Chery
  { id: "chery-tiggo-7-pro", brand: "Chery", model: "Tiggo 7 Pro", generation: "I", yearFrom: 2020, fuelTypes: ["benzin"], tankCapacity: 51 },
  // BYD
  { id: "byd-seal-u-dmi", brand: "BYD", model: "Seal U DM-i", generation: "Plug-in Hibrit", yearFrom: 2024, fuelTypes: ["hibrit"], tankCapacity: 60 },
];
