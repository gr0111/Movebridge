import { completionKey, dateWeekday, validateWorkoutDraft } from "./planner-model.ts";
import type { WorkoutDraft } from "./planner-model.ts";
import type { PlannerData, PlannerRepository } from "./planner-repository.ts";

type Snapshot = PlannerData & {
  status: "guest" | "loading" | "ready" | "error";
  pending: ReadonlySet<string>;
};

export function createPlannerStore(repository: PlannerRepository | null) {
  let snapshot: Snapshot = {
    status: repository ? "loading" : "guest",
    plans: [],
    completions: [],
    pending: new Set(),
  };
  const listeners = new Set<() => void>();
  let lifecycle: { controller: AbortController; reading: boolean } | null = null;

  function update(values: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...values };
    listeners.forEach((listener) => listener());
  }

  async function load() {
    const request = lifecycle;
    if (!repository || !request || request.reading) return;
    request.reading = true;
    update({ status: "loading", plans: [], completions: [], pending: new Set() });
    try {
      const data = await repository.list(request.controller.signal);
      if (request === lifecycle) update({ ...data, status: "ready" });
    } catch {
      if (request === lifecycle) update({ status: "error" });
    } finally {
      request.reading = false;
    }
  }

  function start() {
    const request = { controller: new AbortController(), reading: false };
    lifecycle = request;
    void load();
    return () => {
      if (lifecycle === request) lifecycle = null;
      request.controller.abort();
    };
  }

  async function mutate(
    id: string,
    change: (
      repo: PlannerRepository,
      signal: AbortSignal,
    ) => Promise<(current: PlannerData) => Partial<PlannerData>>,
  ) {
    const request = lifecycle;
    if (!request || !repository || snapshot.status !== "ready" || snapshot.pending.has(id))
      return false;
    update({ pending: new Set([...snapshot.pending, id]) });
    try {
      const result = await change(repository, request.controller.signal);
      if (request !== lifecycle) return false;
      update(result(snapshot));
      return true;
    } catch (error) {
      if (request !== lifecycle) return false;
      throw error;
    } finally {
      if (request === lifecycle) {
        const pending = new Set(snapshot.pending);
        pending.delete(id);
        update({ pending });
      }
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start,
    retry: () => {
      if (snapshot.status === "error") void load();
    },
    save(id: string, draft: WorkoutDraft, editing: boolean) {
      const validated = validateWorkoutDraft(draft);
      if (!validated.fields) throw new Error(validated.error);
      const { fields } = validated;
      return mutate(id, async (repo, signal) => {
        const saved = await repo.save(id, fields, editing, signal);
        return (current) => ({ plans: [...current.plans.filter((plan) => plan.id !== id), saved] });
      });
    },
    remove(id: string) {
      return mutate(id, async (repo, signal) => {
        await repo.remove(id, signal);
        return (current) => ({
          plans: current.plans.filter((plan) => plan.id !== id),
          completions: current.completions.filter((item) => item.plan_id !== id),
        });
      });
    },
    setCompletion(id: string, date: string, completed: boolean) {
      const plan = snapshot.plans.find((item) => item.id === id);
      const weekday = dateWeekday(date);
      if (!plan || weekday === null || (completed && weekday !== plan.day_of_week))
        throw new Error("Completion weekday mismatch");
      return mutate(id, async (repo, signal) => {
        await repo.setCompletion(id, date, completed, signal);
        const key = completionKey(id, date);
        return (current) => {
          const remaining = current.completions.filter(
            (item) => completionKey(item.plan_id, item.performed_on) !== key,
          );
          return {
            completions: completed
              ? [...remaining, { plan_id: id, performed_on: date }]
              : remaining,
          };
        };
      });
    },
  };
}
