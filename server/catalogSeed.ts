// Starter vehicle catalog: the most common models on Turkish roads, with factory fuel tank sizes.
// Values come from the manufacturers' technical data as published per generation/engine on
// auto-data.net (checked September 2026); figures that disagreed between sources were
// cross-checked and noted. Admins extend or correct the catalog from the admin panel.
//
// Bump CATALOG_SEED_VERSION when adding rows here: rows are inserted once per version, so
// admin edits aren't overwritten, but a row an admin deleted comes back after a bump.
import type { CatalogEntry } from "../src/types.ts";
import { FACTORY_CONSUMPTION } from "./catalogFactory.ts";

export const CATALOG_SEED_VERSION = 3;

type Seed = Omit<CatalogEntry, "yearTo" | "lpgTankCapacity" | "note" | "factoryConsumption"> & {
  yearTo?: number;
  lpgTankCapacity?: number;
  note?: string;
};

const BD: CatalogEntry["fuelTypes"] = ["benzin", "dizel"];

const SEED_ROWS: Seed[] = [
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

  // Seed version 2: older generations still common on Turkish roads (the average car there is
  // ~14 years old; TÜİK's most-registered list is led by Tofaş, Corolla, Egea, Clio, Megane,
  // R12, Astra, Focus, Symbol, R9) plus popular models from ODMD sales lists.
  // Tofaş / old Renault
  { id: "tofas-sahin-dogan-kartal", brand: "Tofaş", model: "Şahin / Doğan / Kartal", generation: "131", yearFrom: 1971, yearTo: 2002, fuelTypes: ["benzin"], tankCapacity: 50, note: "Değer Şahin için doğrulandı; Doğan ve Kartal aynı altyapıdadır." },
  { id: "renault-12-toros", brand: "Renault", model: "12 / Toros", generation: "I", yearFrom: 1971, yearTo: 2000, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "renault-9-broadway", brand: "Renault", model: "9 / Broadway", generation: "I", yearFrom: 1985, yearTo: 2000, fuelTypes: ["benzin"], tankCapacity: 47 },
  { id: "renault-clio-2", brand: "Renault", model: "Clio", generation: "II", yearFrom: 1998, yearTo: 2012, fuelTypes: BD, tankCapacity: 50 },
  { id: "renault-clio-3", brand: "Renault", model: "Clio", generation: "III", yearFrom: 2005, yearTo: 2012, fuelTypes: BD, tankCapacity: 55 },
  { id: "renault-symbol-1", brand: "Renault", model: "Symbol", generation: "I", yearFrom: 1999, yearTo: 2008, fuelTypes: BD, tankCapacity: 50 },
  { id: "renault-symbol-2", brand: "Renault", model: "Symbol", generation: "II", yearFrom: 2008, yearTo: 2012, fuelTypes: BD, tankCapacity: 50 },
  { id: "renault-megane-2", brand: "Renault", model: "Megane", generation: "II (Sedan / HB)", yearFrom: 2002, yearTo: 2009, fuelTypes: BD, tankCapacity: 60 },
  { id: "renault-megane-3-hb", brand: "Renault", model: "Megane", generation: "III (HB / Grandtour)", yearFrom: 2008, yearTo: 2015, fuelTypes: BD, tankCapacity: 60 },
  { id: "renault-megane-4-hb", brand: "Renault", model: "Megane", generation: "IV (HB)", yearFrom: 2016, yearTo: 2024, fuelTypes: BD, tankCapacity: 47 },
  { id: "renault-kangoo-2", brand: "Renault", model: "Kangoo", generation: "II", yearFrom: 2008, yearTo: 2021, fuelTypes: BD, tankCapacity: 60 },
  { id: "renault-kadjar", brand: "Renault", model: "Kadjar", generation: "I", yearFrom: 2015, yearTo: 2022, fuelTypes: BD, tankCapacity: 55 },
  { id: "dacia-logan-2", brand: "Dacia", model: "Logan", generation: "II", yearFrom: 2012, yearTo: 2020, fuelTypes: BD, tankCapacity: 50 },
  // Fiat
  { id: "fiat-palio", brand: "Fiat", model: "Palio", generation: "I (178)", yearFrom: 1997, yearTo: 2006, fuelTypes: BD, tankCapacity: 48 },
  { id: "fiat-albea", brand: "Fiat", model: "Albea", generation: "I", yearFrom: 2002, yearTo: 2012, fuelTypes: BD, tankCapacity: 50 },
  { id: "fiat-punto-199", brand: "Fiat", model: "Punto", generation: "Grande Punto / Punto Evo (199)", yearFrom: 2005, yearTo: 2018, fuelTypes: BD, tankCapacity: 45 },
  { id: "fiat-doblo-1", brand: "Fiat", model: "Doblo", generation: "I", yearFrom: 2001, yearTo: 2010, fuelTypes: BD, tankCapacity: 60 },
  { id: "fiat-fiorino-3", brand: "Fiat", model: "Fiorino", generation: "III", yearFrom: 2008, yearTo: 2024, fuelTypes: BD, tankCapacity: 45 },
  // Toyota
  { id: "toyota-corolla-e120", brand: "Toyota", model: "Corolla", generation: "E120", yearFrom: 2001, yearTo: 2007, fuelTypes: BD, tankCapacity: 55 },
  { id: "toyota-corolla-e150", brand: "Toyota", model: "Corolla", generation: "E150", yearFrom: 2007, yearTo: 2013, fuelTypes: BD, tankCapacity: 55 },
  { id: "toyota-auris-2", brand: "Toyota", model: "Auris", generation: "II", yearFrom: 2012, yearTo: 2018, fuelTypes: BD, tankCapacity: 50 },
  { id: "toyota-yaris-3", brand: "Toyota", model: "Yaris", generation: "III", yearFrom: 2011, yearTo: 2020, fuelTypes: ["benzin"], tankCapacity: 42 },
  { id: "toyota-rav4-5-hybrid", brand: "Toyota", model: "RAV4", generation: "V Hibrit", yearFrom: 2018, fuelTypes: ["hibrit"], tankCapacity: 55 },
  // Opel
  { id: "opel-astra-g", brand: "Opel", model: "Astra", generation: "G (Classic dahil)", yearFrom: 1998, yearTo: 2009, fuelTypes: BD, tankCapacity: 52 },
  { id: "opel-astra-h", brand: "Opel", model: "Astra", generation: "H", yearFrom: 2004, yearTo: 2014, fuelTypes: BD, tankCapacity: 52 },
  { id: "opel-astra-j", brand: "Opel", model: "Astra", generation: "J", yearFrom: 2009, yearTo: 2018, fuelTypes: BD, tankCapacity: 56 },
  { id: "opel-corsa-c", brand: "Opel", model: "Corsa", generation: "C", yearFrom: 2000, yearTo: 2006, fuelTypes: BD, tankCapacity: 44 },
  { id: "opel-corsa-d", brand: "Opel", model: "Corsa", generation: "D", yearFrom: 2006, yearTo: 2014, fuelTypes: BD, tankCapacity: 44 },
  { id: "opel-corsa-e", brand: "Opel", model: "Corsa", generation: "E", yearFrom: 2014, yearTo: 2019, fuelTypes: BD, tankCapacity: 45 },
  // Ford
  { id: "ford-focus-2", brand: "Ford", model: "Focus", generation: "II", yearFrom: 2004, yearTo: 2011, fuelTypes: BD, tankCapacity: 53 },
  { id: "ford-fiesta-7", brand: "Ford", model: "Fiesta", generation: "VII", yearFrom: 2008, yearTo: 2017, fuelTypes: BD, tankCapacity: 40, note: "Değer 1.6 TDCi için doğrulandı." },
  { id: "ford-courier-1", brand: "Ford", model: "Transit / Tourneo Courier", generation: "I", yearFrom: 2014, yearTo: 2023, fuelTypes: BD, tankCapacity: 48 },
  { id: "ford-connect-2", brand: "Ford", model: "Transit / Tourneo Connect", generation: "II", yearFrom: 2013, yearTo: 2022, fuelTypes: BD, tankCapacity: 60 },
  // Volkswagen
  { id: "vw-polo-5", brand: "Volkswagen", model: "Polo", generation: "V", yearFrom: 2009, yearTo: 2017, fuelTypes: BD, tankCapacity: 45 },
  { id: "vw-golf-6", brand: "Volkswagen", model: "Golf", generation: "VI", yearFrom: 2008, yearTo: 2012, fuelTypes: BD, tankCapacity: 55 },
  { id: "vw-jetta-6", brand: "Volkswagen", model: "Jetta", generation: "VI", yearFrom: 2010, yearTo: 2018, fuelTypes: BD, tankCapacity: 55 },
  { id: "vw-passat-b6", brand: "Volkswagen", model: "Passat", generation: "B6", yearFrom: 2005, yearTo: 2010, fuelTypes: BD, tankCapacity: 70 },
  { id: "vw-passat-b7", brand: "Volkswagen", model: "Passat", generation: "B7", yearFrom: 2010, yearTo: 2014, fuelTypes: BD, tankCapacity: 70 },
  { id: "vw-caddy-4", brand: "Volkswagen", model: "Caddy", generation: "IV", yearFrom: 2015, yearTo: 2020, fuelTypes: BD, tankCapacity: 60 },
  // Hyundai / Kia
  { id: "hyundai-getz", brand: "Hyundai", model: "Getz", generation: "I", yearFrom: 2002, yearTo: 2011, fuelTypes: BD, tankCapacity: 45 },
  { id: "hyundai-accent-era", brand: "Hyundai", model: "Accent Era", generation: "MC", yearFrom: 2006, yearTo: 2011, fuelTypes: BD, tankCapacity: 45 },
  { id: "hyundai-i20-1", brand: "Hyundai", model: "i20", generation: "I", yearFrom: 2008, yearTo: 2014, fuelTypes: BD, tankCapacity: 45 },
  { id: "hyundai-i20-2", brand: "Hyundai", model: "i20", generation: "II", yearFrom: 2014, yearTo: 2020, fuelTypes: BD, tankCapacity: 50 },
  { id: "kia-rio-3", brand: "Kia", model: "Rio", generation: "III", yearFrom: 2011, yearTo: 2017, fuelTypes: BD, tankCapacity: 43 },
  { id: "kia-rio-4", brand: "Kia", model: "Rio", generation: "IV", yearFrom: 2017, yearTo: 2023, fuelTypes: BD, tankCapacity: 45 },
  { id: "kia-ceed-3", brand: "Kia", model: "Ceed", generation: "III", yearFrom: 2018, fuelTypes: BD, tankCapacity: 50 },
  // Honda
  { id: "honda-civic-8", brand: "Honda", model: "Civic", generation: "VIII (FD Sedan)", yearFrom: 2006, yearTo: 2011, fuelTypes: ["benzin"], tankCapacity: 50 },
  { id: "honda-civic-9", brand: "Honda", model: "Civic", generation: "IX (FB Sedan)", yearFrom: 2012, yearTo: 2016, fuelTypes: BD, tankCapacity: 50 },
  // Peugeot / Citroën
  { id: "peugeot-206", brand: "Peugeot", model: "206 / 206+", generation: "I", yearFrom: 1998, yearTo: 2012, fuelTypes: BD, tankCapacity: 50 },
  { id: "peugeot-207", brand: "Peugeot", model: "207", generation: "I", yearFrom: 2006, yearTo: 2014, fuelTypes: BD, tankCapacity: 50 },
  { id: "peugeot-308-2", brand: "Peugeot", model: "308", generation: "II", yearFrom: 2013, yearTo: 2021, fuelTypes: BD, tankCapacity: 53 },
  { id: "peugeot-5008-2", brand: "Peugeot", model: "5008", generation: "II", yearFrom: 2017, yearTo: 2024, fuelTypes: BD, tankCapacity: 56 },
  { id: "peugeot-408-crossover", brand: "Peugeot", model: "408", generation: "Crossover", yearFrom: 2022, fuelTypes: ["benzin"], tankCapacity: 52 },
  { id: "citroen-c3-aircross-1", brand: "Citroën", model: "C3 Aircross", generation: "I", yearFrom: 2017, yearTo: 2024, fuelTypes: BD, tankCapacity: 45 },
  { id: "citroen-c5-aircross-1", brand: "Citroën", model: "C5 Aircross", generation: "I", yearFrom: 2018, fuelTypes: BD, tankCapacity: 53 },
  // Skoda / Chery
  { id: "skoda-fabia-3", brand: "Skoda", model: "Fabia", generation: "III", yearFrom: 2014, yearTo: 2021, fuelTypes: BD, tankCapacity: 45 },
  { id: "chery-tiggo-4-pro", brand: "Chery", model: "Tiggo 4 Pro", generation: "I", yearFrom: 2022, fuelTypes: ["benzin"], tankCapacity: 51 },
  // Premium
  { id: "mercedes-e-w212", brand: "Mercedes-Benz", model: "E Serisi", generation: "W212", yearFrom: 2009, yearTo: 2016, fuelTypes: BD, tankCapacity: 59, note: "Opsiyonel büyük depoyla satılmış olabilir." },
  { id: "mercedes-e-w213", brand: "Mercedes-Benz", model: "E Serisi", generation: "W213", yearFrom: 2016, yearTo: 2023, fuelTypes: BD, tankCapacity: 50, note: "Opsiyonel büyük depoyla satılmış olabilir." },
  { id: "mercedes-a-w176", brand: "Mercedes-Benz", model: "A Serisi", generation: "W176", yearFrom: 2012, yearTo: 2018, fuelTypes: BD, tankCapacity: 50 },
  { id: "mercedes-a-w177", brand: "Mercedes-Benz", model: "A Serisi", generation: "W177", yearFrom: 2018, fuelTypes: BD, tankCapacity: 43, note: "Opsiyonel büyük depoyla satılmış olabilir." },
  { id: "mercedes-cla-c117", brand: "Mercedes-Benz", model: "CLA", generation: "C117", yearFrom: 2013, yearTo: 2019, fuelTypes: BD, tankCapacity: 50 },
  { id: "bmw-3-f30", brand: "BMW", model: "3 Serisi", generation: "F30", yearFrom: 2011, yearTo: 2019, fuelTypes: BD, tankCapacity: 57 },
  { id: "bmw-5-f10", brand: "BMW", model: "5 Serisi", generation: "F10", yearFrom: 2010, yearTo: 2017, fuelTypes: BD, tankCapacity: 70 },
  { id: "bmw-5-g30", brand: "BMW", model: "5 Serisi", generation: "G30", yearFrom: 2017, yearTo: 2023, fuelTypes: BD, tankCapacity: 66 },
  { id: "audi-a3-8v", brand: "Audi", model: "A3", generation: "8V", yearFrom: 2012, yearTo: 2020, fuelTypes: BD, tankCapacity: 50 },
  { id: "audi-a4-b8", brand: "Audi", model: "A4", generation: "B8", yearFrom: 2007, yearTo: 2015, fuelTypes: BD, tankCapacity: 70, note: "Değer 2.0 TDI için doğrulandı." },
  { id: "audi-a4-b9", brand: "Audi", model: "A4", generation: "B9", yearFrom: 2015, yearTo: 2023, fuelTypes: BD, tankCapacity: 40, note: "Standart depo 40 L; opsiyonel büyük depoyla satılmış olabilir." },
];

export const CATALOG_SEED: CatalogEntry[] = SEED_ROWS.map((row) => ({
  ...row,
  factoryConsumption: FACTORY_CONSUMPTION[row.id],
}));
