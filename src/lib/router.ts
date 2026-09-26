import { useEffect, useState } from "react";

export const VEHICLE_TABS = ["ozet", "dolumlar", "masraflar", "hatirlatmalar", "aylik", "paylasim", "bilgiler"] as const;
export type VehicleTab = (typeof VEHICLE_TABS)[number];

export const VEHICLE_TAB_LABELS: Record<VehicleTab, string> = {
  ozet: "Özet",
  dolumlar: "Dolumlar",
  masraflar: "Masraflar",
  hatirlatmalar: "Hatırlatmalar",
  aylik: "Aylık Rapor",
  paylasim: "Paylaşım",
  bilgiler: "Araç Bilgileri",
};

export type Route =
  | { name: "home" }
  | { name: "new-vehicle" }
  | { name: "admin" }
  | { name: "invite"; token: string }
  | { name: "vehicle"; id: string; tab: VehicleTab };

export const paths = {
  home: "#/",
  newVehicle: "#/arac-ekle",
  admin: "#/admin",
  invite: (token: string) => `#/davet/${encodeURIComponent(token)}`,
  vehicle: (id: string, tab: VehicleTab = "ozet") => `#/arac/${encodeURIComponent(id)}/${tab}`,
};

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "arac-ekle") return { name: "new-vehicle" };
  if (parts[0] === "admin") return { name: "admin" };
  if (parts[0] === "davet" && parts[1]) return { name: "invite", token: decodeURIComponent(parts[1]) };
  if (parts[0] === "arac" && parts[1]) {
    const tab = VEHICLE_TABS.find((t) => t === parts[2]) ?? "ozet";
    return { name: "vehicle", id: decodeURIComponent(parts[1]), tab };
  }
  return { name: "home" };
}

export function navigate(path: string): void {
  window.location.hash = path;
}

/** Hash-based routing so the browser back button works without server-side routes. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
