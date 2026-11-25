import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkoutCompletion, WorkoutFields, WorkoutPlan } from "./planner-model.ts";

export type PlannerData = { plans: WorkoutPlan[]; completions: WorkoutCompletion[] };
export type PlannerRepository = {
  list: (signal: AbortSignal) => Promise<PlannerData>;
  save: (
    id: string,
    fields: WorkoutFields,
    editing: boolean,
    signal: AbortSignal,
  ) => Promise<WorkoutPlan>;
  remove: (id: string, signal: AbortSignal) => Promise<void>;
  setCompletion: (
    planId: string,
    date: string,
    completed: boolean,
    signal: AbortSignal,
  ) => Promise<void>;
};

const planColumns = "id,title,day_of_week,start_time,end_time,note";
const completionColumns = "plan_id,performed_on";

export function plannerRepository(client: SupabaseClient, owner: string): PlannerRepository {
  const plans = () => client.from("workout_plans");
  const completions = () => client.from("workout_completions");
  const pageSize = 500;

  async function listRows(
    table: "workout_plans" | "workout_completions",
    columns: string,
    signal: AbortSignal,
  ) {
    const rows = [];
    let cursor = "";
    for (;;) {
      const query = client
        .from(table)
        .select(columns)
        .eq("user_id", owner)
        .order("id")
        .limit(pageSize);
      if (cursor) query.gt("id", cursor);
      const { data, error } = await query.abortSignal(signal);
      if (error) throw error;
      const page = data as unknown as { id: string }[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
      cursor = page[page.length - 1].id;
    }
  }

  return {
    async list(signal) {
      const [planRows, completionRows] = await Promise.all([
        listRows("workout_plans", planColumns, signal),
        listRows("workout_completions", `id,${completionColumns}`, signal),
      ]);
      return {
        plans: planRows as WorkoutPlan[],
        completions: completionRows as unknown as WorkoutCompletion[],
      };
    },
    async save(id, fields, editing, signal) {
      const query = editing
        ? plans().update(fields).eq("id", id).eq("user_id", owner)
        : plans().insert({ id, user_id: owner, ...fields });
      const { data, error } = await query.select(planColumns).abortSignal(signal).single();
      if (!error) return data;
      // Reuse the creation ID across network retries. If a prior request landed,
      // save the current draft to that exact owner-scoped row.
      if (!editing && error.code === "23505") {
        const result = await plans()
          .update(fields)
          .eq("id", id)
          .eq("user_id", owner)
          .select(planColumns)
          .abortSignal(signal)
          .single();
        if (!result.error) return result.data;
        throw result.error;
      }
      throw error;
    },
    async remove(id, signal) {
      const { error } = await plans()
        .delete()
        .eq("id", id)
        .eq("user_id", owner)
        .abortSignal(signal);
      if (error) throw error;
    },
    async setCompletion(planId, date, completed, signal) {
      const query = completed
        ? completions().insert({ user_id: owner, plan_id: planId, performed_on: date })
        : completions()
            .delete()
            .eq("user_id", owner)
            .eq("plan_id", planId)
            .eq("performed_on", date);
      const { error } = await query.abortSignal(signal);
      if (error && !(completed && error.code === "23505")) throw error;
    },
  };
}
