import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

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
  | { name: "vehicle"; id: string; tab: VehicleTab }
  | { name: "wrapped"; year: number };

export const paths = {
  home: "#/",
  newVehicle: "#/arac-ekle",
  admin: "#/admin",
  invite: (token: string) => `#/davet/${encodeURIComponent(token)}`,
  vehicle: (id: string, tab: VehicleTab = "ozet") => `#/arac/${encodeURIComponent(id)}/${tab}`,
  wrapped: (year: number) => `#/yil-ozeti/${year}`,
};

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "arac-ekle") return { name: "new-vehicle" };
  if (parts[0] === "admin") return { name: "admin" };
  if (parts[0] === "yil-ozeti" && /^\d{4}$/.test(parts[1] ?? "")) return { name: "wrapped", year: Number(parts[1]) };
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

/** How deep a page sits: the garage is 0, pages opened from it are 1. */
function depth(route: Route): number {
  return route.name === "home" ? 0 : 1;
}

/**
 * Hash-based routing so the browser back button works without server-side routes.
 * Page changes animate like a native app where the browser supports view transitions: going
 * deeper slides the new page in from the right, going back slides it in from the left, and
 * switching tabs of the same vehicle cross-fades. The year-in-review overlay has its own motion.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const current = useRef(route);

  useEffect(() => {
    function onHashChange() {
      const next = parseHash(window.location.hash);
      const prev = current.current;
      current.current = next;
      const apply = () => {
        setRoute(next);
        window.scrollTo(0, 0);
      };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const overlay = next.name === "wrapped" || prev.name === "wrapped";
      if (!document.startViewTransition || reduce || overlay) {
        apply();
        return;
      }
      const sameVehicle = prev.name === "vehicle" && next.name === "vehicle" && prev.id === next.id;
      document.documentElement.dataset.nav = sameVehicle
        ? "tab"
        : depth(next) > depth(prev)
          ? "forward"
          : depth(next) < depth(prev)
            ? "back"
            : "tab";
      document.startViewTransition(() => flushSync(apply));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
