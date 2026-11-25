import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { authUrl, readAuthCallback, resetCompletedKey } from "./auth-flow";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

const urlCallback = readAuthCallback(new URL(window.location.href));
const callback =
  urlCallback?.action === "reset-complete" && !hasCompletedReset() ? null : urlCallback;
const recovery = callback?.action === "recovery";
const bootError = "인증 서버에 연결할 수 없습니다. 새로고침한 뒤 다시 시도해 주세요.";
let startup: Promise<SupabaseClient> | undefined;

function hasCompletedReset() {
  try {
    const completed = sessionStorage.getItem(resetCompletedKey) === "true";
    sessionStorage.removeItem(resetCompletedKey);
    return completed;
  } catch {
    return false;
  }
}

function prepareClient() {
  startup ??= getSupabase(recovery)!.then(async (client) => {
    if (callback?.action === "reset-complete") {
      const { data } = await client.auth.getSession();
      if (data.session) {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
    }
    return client;
  });
  return startup;
}

type AuthState = {
  client: SupabaseClient | null;
  session: Session | null;
  pending: boolean;
  error: string;
};

const AuthContext = createContext<(AuthState & { callback: typeof callback }) | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    client: null,
    session: null,
    pending: supabaseConfigured,
    error: supabaseConfigured
      ? ""
      : "인증 설정이 없습니다. Supabase 프로젝트 URL과 공개 키 설정을 확인해 주세요.",
  });
  useEffect(() => {
    if (urlCallback) {
      // Retain a non-secret recovery marker so an interrupted recovery cannot look like a login.
      window.history.replaceState(
        window.history.state,
        "",
        authUrl(new URL(window.location.href), recovery ? "recovery" : null),
      );
    }
    if (!supabaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void prepareClient()
      .then(async (client) => {
        if (!active) return;
        let changed = false;
        const update = (session: Session | null) => {
          if (active)
            setState({ client, session: recovery ? null : session, pending: false, error: "" });
        };
        const { data } = client.auth.onAuthStateChange((event, session) => {
          if (event !== "INITIAL_SESSION") {
            changed = true;
            update(session);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const snapshot = await client.auth.getSession();
        if (!active || changed) return;
        if (snapshot.error) {
          setState({ client, session: null, pending: false, error: bootError });
        } else {
          update(snapshot.data.session);
        }
      })
      .catch(() => {
        if (active) setState({ client: null, session: null, pending: false, error: bootError });
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return <AuthContext.Provider value={{ ...state, callback }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
