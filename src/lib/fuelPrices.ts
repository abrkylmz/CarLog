// City pump prices shared by everything that shows them (the price card, the "Bugün" strip):
// one request per page load, one chosen city.
import { useEffect, useSyncExternalStore } from "react";
import type { FuelPrices, FuelType } from "../types";
import { api, errorMessage } from "./api";

interface State {
  data: FuelPrices | null;
  error: string | null;
  city: string | null;
  /** Whose city `city` is, so another account signing in starts from its own. */
  userId: string | null;
}

let state: State = { data: null, error: null, city: null, userId: null };
let loading = false;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function loadFuelPrices(force = false) {
  if (loading || (state.data && !force)) return;
  loading = true;
  set({ error: null });
  api.fuelPrices().then(
    (data) => {
      loading = false;
      set({ data });
    },
    (err) => {
      loading = false;
      set({ error: errorMessage(err) });
    },
  );
}

export async function chooseFuelCity(code: string | null) {
  const before = state.city;
  set({ city: code, error: null });
  try {
    await api.setFuelCity(code);
  } catch (err) {
    set({ city: before, error: errorMessage(err) });
  }
}

/** The prices and the city chosen on the account (`user` from the session). */
export function useFuelPrices(user: { id: string; fuelCity?: string | null } | null | undefined) {
  if (user && state.userId !== user.id) state = { ...state, userId: user.id, city: user.fuelCity ?? null };
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => loadFuelPrices(), []);
  const current = snapshot.data?.cities.find((c) => c.code === snapshot.city);
  return { ...snapshot, current, reload: () => loadFuelPrices(true), choose: chooseFuelCity };
}

/** Which of the three prices matters for a vehicle's fuel. */
export function priceKind(fuel: FuelType): "benzin" | "motorin" | "lpg" {
  return fuel === "dizel" ? "motorin" : fuel === "lpg" || fuel === "benzin-lpg" ? "lpg" : "benzin";
}
