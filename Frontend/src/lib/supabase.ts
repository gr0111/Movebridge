import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function validProjectUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const project = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(project.hostname);
    return (
      !project.username &&
      !project.password &&
      !project.search &&
      !project.hash &&
      (project.protocol === "https:" || (local && project.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

export const supabaseConfigured =
  validProjectUrl(url) &&
  Boolean(
    key?.startsWith("sb_publishable_") && key !== "sb_publishable_replace_with_your_project_key",
  );

let client: Promise<SupabaseClient> | undefined;

export function getSupabase(recovery: boolean) {
  if (!supabaseConfigured) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, key!, {
      auth: {
        detectSessionInUrl: false,
        persistSession: !recovery,
        storageKey: `movebridge-${recovery ? "recovery" : "auth"}-${new URL(url!).host}`,
      },
    }),
  );
  return client;
}
