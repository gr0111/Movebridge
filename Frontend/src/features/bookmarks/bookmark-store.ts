import type { CourseBookmarkRepository } from "./bookmark-repository.ts";
import { matchCourseBookmarks } from "./content-key.ts";

type Snapshot = {
  ids: ReadonlySet<number>;
  pending: ReadonlySet<number>;
  errors: ReadonlyMap<number, string>;
  status: "loading" | "error" | "ready";
  unavailableCount: number;
};

export function createBookmarkStore(
  owner: string | null,
  knownIds: ReadonlySet<number>,
  repository: CourseBookmarkRepository | null,
) {
  let snapshot: Snapshot = {
    ids: new Set(),
    pending: new Set(),
    errors: new Map(),
    status: owner ? "loading" : "ready",
    unavailableCount: 0,
  };
  const subscriptions = new Set<() => void>();
  let lifecycle: { controller: AbortController; reading: boolean } | null = null;

  function update(next: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...next };
    subscriptions.forEach((notify) => notify());
  }

  async function load() {
    const request = lifecycle;
    if (!owner || !request || request.reading) return;
    if (!repository) {
      update({ status: "error" });
      return;
    }
    request.reading = true;
    update({ status: "loading", pending: new Set() });
    try {
      const keys = await repository.list(request.controller.signal);
      if (request === lifecycle)
        update({ ...matchCourseBookmarks(keys, knownIds), status: "ready" });
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

  function applyToggle(id: number, removing: boolean) {
    const ids = new Set(snapshot.ids);
    if (removing) ids.delete(id);
    else ids.add(id);
    update({ ids });
  }

  async function toggle(id: number) {
    if (!knownIds.has(id) || snapshot.status !== "ready" || snapshot.pending.has(id)) return;
    const removing = snapshot.ids.has(id);
    if (!owner) {
      applyToggle(id, removing);
      return;
    }
    const request = lifecycle;
    if (!repository || !request) return;

    const errors = new Map(snapshot.errors);
    errors.delete(id);
    update({ pending: new Set([...snapshot.pending, id]), errors });
    try {
      const change = removing ? repository.remove : repository.save;
      await change(id, request.controller.signal);
      if (request === lifecycle) applyToggle(id, removing);
    } catch {
      if (request === lifecycle) {
        const nextErrors = new Map(snapshot.errors);
        nextErrors.set(
          id,
          removing
            ? "관심 강좌를 해제하지 못했어요. 버튼을 다시 눌러 주세요."
            : "관심 강좌를 저장하지 못했어요. 버튼을 다시 눌러 주세요.",
        );
        update({ errors: nextErrors });
      }
    } finally {
      if (request === lifecycle) {
        const pending = new Set(snapshot.pending);
        pending.delete(id);
        update({ pending });
      }
    }
  }

  return {
    owner,
    subscribe(notify: () => void) {
      subscriptions.add(notify);
      return () => subscriptions.delete(notify);
    },
    getSnapshot: () => snapshot,
    start,
    retry: () => {
      if (snapshot.status === "error") void load();
    },
    toggle,
  };
}
