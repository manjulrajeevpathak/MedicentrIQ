import { cache } from "react";
import { cookies } from "next/headers";
import { getDashboardData } from "./core-api";
import { ACTIVE_USER_COOKIE } from "./constants";

/**
 * Per-request memoized dashboard fetch. Reads the "view as" demo user from a
 * cookie so role/permission switching in the UI flows through to server reads.
 */
export const getDashboard = cache(async () => {
  const store = await cookies();
  const userId = store.get(ACTIVE_USER_COOKIE)?.value || undefined;
  return getDashboardData(userId);
});
