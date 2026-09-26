// Per-vehicle access rules. Every vehicle has one owner and any number of helpers:
//   - members (owner or helper) see the vehicle and add fill-ups, expenses, reminders;
//   - a record can be edited and deleted by its author or the vehicle's owner;
//   - only the owner deletes the vehicle, edits its details and manages sharing.
// The site admin role only manages accounts and grants no access to other people's vehicles.
// A vehicle the user can't access answers 404, so its existence isn't revealed.
import type { Request } from "express";
import type { VehicleRole } from "../src/types.ts";
import { queryOne } from "./db.ts";

export async function vehicleRole(userId: string, vehicleId: string): Promise<VehicleRole | null> {
  const row = await queryOne("SELECT role FROM vehicle_members WHERE vehicle_id = $1 AND user_id = $2", [
    vehicleId,
    userId,
  ]);
  return (row?.role as VehicleRole | undefined) ?? null;
}

export type RecordTable = "entries" | "expenses" | "reminders";

export interface RecordAccess {
  vehicleId: string;
  createdBy: string | null;
  role: VehicleRole;
  canEdit: boolean;
  canDelete: boolean;
}

/** The caller's rights on one fill-up / expense / reminder, or null if it doesn't exist for them. */
export async function recordAccess(req: Request, table: RecordTable, id: string): Promise<RecordAccess | null> {
  const row = await queryOne(
    `SELECT r.vehicle_id, r.created_by, m.role
     FROM ${table} r JOIN vehicle_members m ON m.vehicle_id = r.vehicle_id AND m.user_id = $2
     WHERE r.id = $1`,
    [id, req.user!.id],
  );
  if (!row) return null;
  const role = row.role as VehicleRole;
  const createdBy = (row.created_by as string | null) ?? null;
  return {
    vehicleId: row.vehicle_id as string,
    createdBy,
    role,
    canEdit: role === "owner" || createdBy === req.user!.id,
    canDelete: role === "owner" || createdBy === req.user!.id,
  };
}

export const NOT_FOUND = "Kayıt bulunamadı.";
export const VEHICLE_NOT_FOUND = "Araç bulunamadı.";
export const OWNER_ONLY = "Bu işlemi yalnızca aracın sahibi yapabilir.";
export const EDIT_OWN_ONLY = "Yalnızca kendi eklediğiniz kayıtları düzenleyebilirsiniz.";
export const DELETE_OWN_ONLY = "Yalnızca kendi eklediğiniz kayıtları silebilirsiniz.";
