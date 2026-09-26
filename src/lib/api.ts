import type {
  Expense,
  ExpenseInput,
  FuelEntry,
  FuelEntryInput,
  InvitePreview,
  Reminder,
  ReminderInput,
  Role,
  User,
  Vehicle,
  VehicleInput,
  VehicleInvite,
  VehicleMember,
} from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** "done": an admin exists; "available": first admin can be created with the setup key; "needs-key": ADMIN_SETUP_KEY isn't set. */
export type AdminSetupState = "done" | "available" | "needs-key";

/** Fired when the server says the session is gone, so the app can drop back to the login screen. */
export const UNAUTHORIZED_EVENT = "carlog:unauthorized";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.", 0);
  }

  if (res.status === 401 && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `İstek başarısız (${res.status}).`, res.status);
  }
  return data as T;
}

export const api = {
  authStatus: () => request<{ user: User | null; adminSetup: AdminSetupState }>("GET", "/auth/status"),
  setupAdmin: (username: string, password: string, setupKey: string) =>
    request<{ user: User }>("POST", "/auth/setup", { username, password, setupKey }),
  register: (username: string, password: string) =>
    request<{ user: User }>("POST", "/auth/register", { username, password }),
  login: (username: string, password: string, panel: "user" | "admin") =>
    request<{ user: User }>("POST", "/auth/login", { username, password, panel }),
  logout: () => request<void>("POST", "/auth/logout"),

  listVehicles: () => request<Vehicle[]>("GET", "/vehicles"),
  createVehicle: (input: VehicleInput) => request<Vehicle>("POST", "/vehicles", input),
  updateVehicle: (id: string, input: VehicleInput) =>
    request<Vehicle>("PUT", `/vehicles/${encodeURIComponent(id)}`, input),
  deleteVehicle: (id: string) => request<void>("DELETE", `/vehicles/${encodeURIComponent(id)}`),

  listMembers: (vehicleId: string) =>
    request<VehicleMember[]>("GET", `/vehicles/${encodeURIComponent(vehicleId)}/members`),
  addMember: (vehicleId: string, username: string) =>
    request<VehicleMember[]>("POST", `/vehicles/${encodeURIComponent(vehicleId)}/members`, { username }),
  /** The owner removes a helper, or a helper passes their own id to leave. */
  removeMember: (vehicleId: string, userId: string) =>
    request<void>("DELETE", `/vehicles/${encodeURIComponent(vehicleId)}/members/${encodeURIComponent(userId)}`),
  listInvites: (vehicleId: string) =>
    request<VehicleInvite[]>("GET", `/vehicles/${encodeURIComponent(vehicleId)}/invites`),
  /** The token is only returned here; the server keeps just its hash. */
  createInvite: (vehicleId: string) =>
    request<{ invite: VehicleInvite; token: string }>("POST", `/vehicles/${encodeURIComponent(vehicleId)}/invites`),
  revokeInvite: (vehicleId: string, inviteId: string) =>
    request<void>("DELETE", `/vehicles/${encodeURIComponent(vehicleId)}/invites/${encodeURIComponent(inviteId)}`),
  invitePreview: (token: string) => request<InvitePreview>("GET", `/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) =>
    request<{ vehicleId: string; alreadyMember: boolean }>("POST", `/invites/${encodeURIComponent(token)}/accept`),

  listEntries: () => request<FuelEntry[]>("GET", "/entries"),
  createEntry: (input: FuelEntryInput) => request<FuelEntry>("POST", "/entries", input),
  updateEntry: (id: string, input: FuelEntryInput) =>
    request<FuelEntry>("PUT", `/entries/${encodeURIComponent(id)}`, input),
  deleteEntry: (id: string) => request<void>("DELETE", `/entries/${encodeURIComponent(id)}`),

  listExpenses: () => request<Expense[]>("GET", "/expenses"),
  createExpense: (input: ExpenseInput) => request<Expense>("POST", "/expenses", input),
  updateExpense: (id: string, input: ExpenseInput) =>
    request<Expense>("PUT", `/expenses/${encodeURIComponent(id)}`, input),
  deleteExpense: (id: string) => request<void>("DELETE", `/expenses/${encodeURIComponent(id)}`),

  listReminders: () => request<Reminder[]>("GET", "/reminders"),
  createReminder: (input: ReminderInput) => request<Reminder>("POST", "/reminders", input),
  updateReminder: (id: string, input: ReminderInput) =>
    request<Reminder>("PUT", `/reminders/${encodeURIComponent(id)}`, input),
  /** amount (optional) is also recorded as an expense. */
  completeReminder: (id: string, amount?: number) =>
    request<{ completed: Reminder; next: Reminder | null; expense: Expense | null }>(
      "POST",
      `/reminders/${encodeURIComponent(id)}/complete`,
      { amount },
    ),
  deleteReminder: (id: string) => request<void>("DELETE", `/reminders/${encodeURIComponent(id)}`),

  listUsers: () => request<User[]>("GET", "/users"),
  createUser: (username: string, password: string, role: Role) =>
    request<User>("POST", "/users", { username, password, role }),
  setUserPassword: (id: string, password: string) =>
    request<void>("PUT", `/users/${encodeURIComponent(id)}/password`, { password }),
  /** Without force, a user who owns vehicles gets a 409 describing what would happen. */
  deleteUser: (id: string, force = false) =>
    request<void>("DELETE", `/users/${encodeURIComponent(id)}${force ? "?force=1" : ""}`),

  importLegacy: (data: { vehicles: unknown[]; entries: unknown[] }) =>
    request<{ vehicles: number; entries: number }>("POST", "/import", data),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
}
