// Before the server existed, everything lived in this browser's localStorage.
// These helpers read that data once so an admin can import it to the server.

const VEHICLES_KEY = "carlog:vehicles:v1";
const ENTRIES_KEY = "carlog:entries:v1";

type LegacyRecord = Record<string, unknown>;

function readArray(key: string): LegacyRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Returns browser-stored data, or null when there's nothing to import. */
export function readLegacyData(): { vehicles: LegacyRecord[]; entries: LegacyRecord[] } | null {
  const vehicles = readArray(VEHICLES_KEY);
  let entries = readArray(ENTRIES_KEY);
  if (vehicles.length === 0 && entries.length === 0) return null;

  // Entries from before multi-vehicle support have no vehicleId.
  if (entries.some((e) => !e.vehicleId)) {
    let target = vehicles[0];
    if (!target) {
      target = { id: crypto.randomUUID(), name: "Aracım", fuelType: "benzin" };
      vehicles.push(target);
    }
    entries = entries.map((e) => (e.vehicleId ? e : { ...e, vehicleId: target.id }));
  }

  return { vehicles, entries };
}

export function clearLegacyData(): void {
  try {
    localStorage.removeItem(VEHICLES_KEY);
    localStorage.removeItem(ENTRIES_KEY);
  } catch {
    // Storage may be blocked; nothing to clear then.
  }
}
