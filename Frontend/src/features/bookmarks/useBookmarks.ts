import { useEffect, useState, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "../../auth/AuthProvider";
import { courses, onlineVideos } from "../../data/search";
import { courseBookmarkRepository } from "./bookmark-repository";
import { createBookmarkStore } from "./bookmark-store";
import { bookmarkKind, videoContentKey } from "./content-key";

const knownCourseIds = new Set(courses.map((course) => course.id));
const knownVideoKeys = new Set(onlineVideos.map(videoContentKey).filter((key) => key !== null));

function bookmarkScope(owner: string | null, client: SupabaseClient | null) {
  return {
    client,
    store: createBookmarkStore(
      owner,
      knownCourseIds,
      owner && client ? courseBookmarkRepository(client, owner) : null,
      knownVideoKeys,
    ),
  };
}

export function useBookmarks() {
  const { client, session, pending } = useAuth();
  const owner = session?.user.id ?? null;
  const memberClient = owner ? client : null;
  const [scope, setScope] = useState(() => bookmarkScope(owner, memberClient));
  let current = scope;
  if (scope.store.owner !== owner || scope.client !== memberClient) {
    current = bookmarkScope(owner, memberClient);
    setScope(current);
  }
  const { store } = current;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(store.start, [store]);
  return {
    ...snapshot,
    unavailableCount: [...snapshot.unavailable].filter((key) => bookmarkKind(key) === "course")
      .length,
    owner,
    loading: pending || snapshot.status === "loading",
    ready: !pending && snapshot.status === "ready",
    toggle: store.toggle,
    retry: store.retry,
    removeUnavailable: store.removeUnavailable,
  };
}
