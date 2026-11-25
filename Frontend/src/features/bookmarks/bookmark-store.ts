import type { CourseBookmarkRepository } from "./bookmark-repository.ts";
import { matchCourseBookmarks } from "./content-key.ts";

type BookmarkTarget = number | string;

type Snapshot = {
  ids: ReadonlySet<number>;
  pending: ReadonlySet<BookmarkTarget>;
  errors: ReadonlyMap<BookmarkTarget, string>;
  status: "loading" | "error" | "ready";
  unavailable: ReadonlySet<string>;
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
    unavailable: new Set(),
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

  async function mutate(
    target: BookmarkTarget,
    change: (signal: AbortSignal) => Promise<void>,
    commit: () => void,
    errorMessage: string,
  ) {
    const request = lifecycle;
    if (!request || snapshot.status !== "ready" || snapshot.pending.has(target)) return;

    const errors = new Map(snapshot.errors);
    errors.delete(target);
    update({ pending: new Set([...snapshot.pending, target]), errors });
    try {
      await change(request.controller.signal);
      if (request === lifecycle) commit();
    } catch {
      if (request === lifecycle) {
        const nextErrors = new Map(snapshot.errors);
        nextErrors.set(target, errorMessage);
        update({ errors: nextErrors });
      }
    } finally {
      if (request === lifecycle) {
        const pending = new Set(snapshot.pending);
        pending.delete(target);
        update({ pending });
      }
    }
  }

  async function toggle(id: number) {
    if (!knownIds.has(id) || snapshot.status !== "ready") return;
    const removing = snapshot.ids.has(id);
    if (!owner) {
      applyToggle(id, removing);
      return;
    }
    if (!repository) return;
    await mutate(
      id,
      (signal) => (removing ? repository.remove(id, signal) : repository.save(id, signal)),
      () => applyToggle(id, removing),
      removing
        ? "관심 강좌를 해제하지 못했어요. 버튼을 다시 눌러 주세요."
        : "관심 강좌를 저장하지 못했어요. 버튼을 다시 눌러 주세요.",
    );
  }

  async function removeUnavailable(key: string) {
    if (!owner || !repository || !snapshot.unavailable.has(key)) return;
    await mutate(
      key,
      (signal) => repository.removeUnavailable(key, signal),
      () => {
        const unavailable = new Set(snapshot.unavailable);
        unavailable.delete(key);
        update({ unavailable });
      },
      "북마크를 삭제하지 못했어요. 다시 시도해 주세요.",
    );
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
    removeUnavailable,
  };
}
