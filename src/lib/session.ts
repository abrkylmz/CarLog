import { createContext, useContext } from "react";
import type { Services } from "./api";
import type { User } from "../types";

/** The signed-in user and which optional server services are set up, for components deep in the tree. */
export interface Session {
  user: User;
  services: Services;
}

export const SessionContext = createContext<Session | null>(null);

/** null outside the signed-in app (e.g. on the login screen). */
export function useSession(): Session | null {
  return useContext(SessionContext);
}
