import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { plannerRepository } from "./planner-repository.ts";
import { createPlannerStore } from "./planner-store.ts";

export function useWorkoutPlanner(enabled: boolean) {
  const { session, client, pending } = useAuth();
  const owner = enabled && !pending && client ? (session?.user.id ?? null) : null;
  const store = useMemo(
    () => createPlannerStore(owner && client ? plannerRepository(client, owner) : null),
    [owner, client],
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(store.start, [store]);
  return { ...snapshot, status: pending ? ("loading" as const) : snapshot.status, owner, store };
}
