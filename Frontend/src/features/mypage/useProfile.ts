import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { profileRepository } from "./profile";
import type { Profile } from "./profile";

type LoadState = { status: "loading" | "error" } | { status: "ready"; profile: Profile };

export function useProfile(client: SupabaseClient, userId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const scope = useRef<{ controller: AbortController; saving: boolean } | null>(null);

  useEffect(() => {
    const request = { controller: new AbortController(), saving: false };
    scope.current = request;
    void profileRepository(client, userId)
      .load(request.controller.signal)
      .then(
        (profile) => {
          if (scope.current === request) setState({ status: "ready", profile });
        },
        () => {
          if (scope.current === request) setState({ status: "error" });
        },
      );
    return () => {
      scope.current = null;
      request.controller.abort();
    };
  }, [client, userId, attempt]);

  function retry() {
    if (state.status !== "error") return;
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }

  async function save(name: string | null) {
    const request = scope.current;
    if (!request || request.saving || state.status !== "ready") return false;
    request.saving = true;
    setSaving(true);
    try {
      const profile = await profileRepository(client, userId).save(name, request.controller.signal);
      if (scope.current !== request) return false;
      setState({ status: "ready", profile });
      return true;
    } catch (error) {
      if (scope.current !== request) return false;
      throw error;
    } finally {
      if (scope.current === request) {
        request.saving = false;
        setSaving(false);
      }
    }
  }

  return { state, retry, save, saving };
}
