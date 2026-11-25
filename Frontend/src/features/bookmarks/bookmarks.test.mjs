import test from "node:test";
import assert from "node:assert/strict";
import { courseContentKey, courseIdForKey, matchCourseBookmarks } from "./content-key.ts";
import { courseBookmarkRepository } from "./bookmark-repository.ts";
import { createBookmarkStore } from "./bookmark-store.ts";

const knownIds = new Set([123, 456]);
const savedIds = (store) => [...store.getSnapshot().ids];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const repo = (overrides = {}) => ({
  list: async () => [],
  save: async () => {},
  remove: async () => {},
  removeUnavailable: async () => {},
  ...overrides,
});

test("unavailable deletion uses the exact saved course key and owner", async () => {
  const signal = new AbortController().signal;
  const key = "course:institution:000123";
  const client = mockClient([{ error: null }]);
  const bookmarks = courseBookmarkRepository(client, "member-a");
  await bookmarks.removeUnavailable(key, signal);
  await assert.rejects(bookmarks.removeUnavailable("other:institution:123", signal));
  assert.deepEqual(client.calls[0].slice(0, 4), [
    ["from", "bookmarks"],
    ["delete"],
    ["eq", "user_id", "member-a"],
    ["eq", "content_key", key],
  ]);
  assert.equal(client.calls.length, 1);
});

test("unavailable deletion keeps the item until success and preserves it on failure", async () => {
  const key = "course:institution:999";
  let calls = 0;
  const retry = deferred();
  const store = createBookmarkStore(
    "member-a",
    knownIds,
    repo({
      list: async () => [key, "course:institution:123"],
      removeUnavailable: async () => {
        if (++calls === 1) throw new Error("network");
        return retry.promise;
      },
    }),
  );
  const stop = store.start();
  await Promise.resolve();
  await store.removeUnavailable("course:institution:123");
  assert.equal(calls, 0);
  await store.removeUnavailable(key);
  assert.equal(store.getSnapshot().unavailable.has(key), true);
  assert.match(store.getSnapshot().errors.get(key), /삭제하지/);
  const removing = store.removeUnavailable(key);
  await store.removeUnavailable(key);
  assert.equal(calls, 2);
  assert.equal(store.getSnapshot().unavailable.has(key), true);
  retry.resolve();
  await removing;
  assert.equal(store.getSnapshot().unavailable.size, 0);
  assert.deepEqual(savedIds(store), [123]);
  stop();
});

function mockClient(responses) {
  const calls = [];
  return {
    calls,
    from(table) {
      const operation = [["from", table]];
      calls.push(operation);
      const query = {
        then(resolve, reject) {
          assert.ok(responses.length, "unexpected database request");
          return Promise.resolve(responses.shift()).then(resolve, reject);
        },
      };
      for (const name of [
        "select",
        "insert",
        "delete",
        "eq",
        "like",
        "order",
        "limit",
        "gt",
        "abortSignal",
        "maybeSingle",
      ]) {
        query[name] = (...args) => {
          operation.push([name, ...args]);
          return query;
        };
      }
      return query;
    },
  };
}

test("course content keys round-trip without colliding with either video source", () => {
  assert.equal(courseContentKey(123), "course:institution:123");
  assert.equal(courseIdForKey("course:institution:123"), 123);
  assert.equal(courseIdForKey("video:institution:123"), null);
  assert.equal(courseIdForKey("video:youtube:MB-C123"), null);
});

test("invalid, imprecise and noncanonical IDs are rejected before writes", async () => {
  for (const id of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "123"])
    assert.equal(courseContentKey(id), null);
  for (const key of ["course:institution:", "course:institution:0123", "course:institution:1e3"])
    assert.equal(courseIdForKey(key), null);
  const client = mockClient([]);
  await assert.rejects(
    courseBookmarkRepository(client, "a").save(NaN, new AbortController().signal),
  );
  assert.deepEqual(client.calls, []);
});

test("reconciliation deduplicates courses and counts unresolved course keys without including videos", () => {
  const result = matchCourseBookmarks(
    [
      "course:institution:123",
      "course:institution:123",
      "course:institution:789",
      "course:institution:0123",
      "video:institution:123",
    ],
    knownIds,
  );
  assert.deepEqual([...result.ids], [123]);
  assert.equal(result.unavailable.size, 2);
});

test("repository reads the owner's course rows and continues from the last key", async () => {
  const client = mockClient([
    { data: [{ content_key: "course:institution:123" }], error: null },
    { data: [{ content_key: "course:institution:456" }], error: null },
    { data: [], error: null },
  ]);
  const signal = new AbortController().signal;
  assert.deepEqual(await courseBookmarkRepository(client, "a").list(signal), [
    "course:institution:123",
    "course:institution:456",
  ]);
  for (const call of client.calls) {
    assert.ok(
      call.some(([method, column, id]) => method === "eq" && column === "user_id" && id === "a"),
    );
  }
  assert.deepEqual(
    client.calls[1].find(([method]) => method === "gt"),
    ["gt", "content_key", "course:institution:123"],
  );
});

test("duplicate INSERT succeeds only after finding the exact owner and content key", async () => {
  const duplicate = { code: "23505" };
  const signal = new AbortController().signal;
  const client = mockClient([
    { error: duplicate },
    { error: null, data: { content_key: "course:institution:123" } },
    { error: duplicate },
    { error: null, data: null },
  ]);
  const bookmarks = courseBookmarkRepository(client, "a");
  await bookmarks.save(123, signal);
  await assert.rejects(bookmarks.save(456, signal), (error) => error === duplicate);
  assert.deepEqual(client.calls[0][1], [
    "insert",
    { user_id: "a", content_key: "course:institution:123" },
  ]);
  assert.deepEqual(
    client.calls[1].filter(([method]) => method === "eq"),
    [
      ["eq", "user_id", "a"],
      ["eq", "content_key", "course:institution:123"],
    ],
  );
});

test("repository deletes only the exact course key and owner", async () => {
  const client = mockClient([{ error: null }]);
  await courseBookmarkRepository(client, "a").remove(123, new AbortController().signal);
  assert.deepEqual(client.calls[0].slice(0, 4), [
    ["from", "bookmarks"],
    ["delete"],
    ["eq", "user_id", "a"],
    ["eq", "content_key", "course:institution:123"],
  ]);
});

test("server confirmation controls saved state and repeated clicks cannot double-submit", async () => {
  const save = deferred();
  const remove = deferred();
  let saves = 0;
  const store = createBookmarkStore(
    "a",
    knownIds,
    repo({
      save: () => {
        saves++;
        return save.promise;
      },
      remove: () => remove.promise,
    }),
  );
  const stop = store.start();
  await Promise.resolve();
  const adding = store.toggle(123);
  await store.toggle(123);
  assert.equal(saves, 1);
  assert.equal(store.getSnapshot().pending.has(123), true);
  assert.deepEqual(savedIds(store), []);
  save.resolve();
  await adding;
  assert.deepEqual(savedIds(store), [123]);
  const deleting = store.toggle(123);
  assert.deepEqual(savedIds(store), [123]);
  remove.resolve();
  await deleting;
  assert.deepEqual(savedIds(store), []);
  stop();
});

test("network errors preserve state, and a subsequent save or removal can succeed", async () => {
  let saveAttempts = 0;
  let removalAttempts = 0;
  const store = createBookmarkStore(
    "a",
    knownIds,
    repo({
      save: async () => {
        if (++saveAttempts === 1) throw new Error("network");
      },
      remove: async () => {
        if (++removalAttempts === 1) throw new Error("network");
      },
    }),
  );
  const stop = store.start();
  await Promise.resolve();
  await store.toggle(123);
  assert.deepEqual(savedIds(store), []);
  assert.match(store.getSnapshot().errors.get(123), /저장하지/);
  await store.toggle(123);
  assert.deepEqual(savedIds(store), [123]);
  assert.equal(store.getSnapshot().errors.size, 0);
  await store.toggle(123);
  assert.deepEqual(savedIds(store), [123]);
  assert.match(store.getSnapshot().errors.get(123), /해제하지/);
  await store.toggle(123);
  assert.deepEqual(savedIds(store), []);
  stop();
});

test("initial load failure is distinguishable from empty success and can be retried", async () => {
  let attempts = 0;
  const store = createBookmarkStore(
    "a",
    knownIds,
    repo({
      list: async () => {
        if (++attempts === 1) throw new Error("network");
        return ["course:institution:456"];
      },
    }),
  );
  const stop = store.start();
  assert.equal(store.getSnapshot().status, "loading");
  await Promise.resolve();
  assert.equal(store.getSnapshot().status, "error");
  await store.toggle(123);
  assert.equal(store.getSnapshot().ids.size, 0);
  store.retry();
  await Promise.resolve();
  assert.equal(store.getSnapshot().status, "ready");
  assert.deepEqual(savedIds(store), [456]);
  stop();
});

test("a superseded load is aborted and ignored even when the response arrives last", async () => {
  const slow = deferred();
  let firstSignal;
  let calls = 0;
  const store = createBookmarkStore(
    "a",
    knownIds,
    repo({
      list(signal) {
        if (++calls === 1) {
          firstSignal = signal;
          return slow.promise;
        }
        return Promise.resolve(["course:institution:456"]);
      },
    }),
  );
  const stopFirst = store.start();
  stopFirst();
  assert.equal(firstSignal.aborted, true);
  const stopSecond = store.start();
  await Promise.resolve();
  slow.resolve(["course:institution:123"]);
  await Promise.resolve();
  assert.deepEqual(savedIds(store), [456]);
  stopSecond();
});

test("a late write during an account switch cannot affect the next account or guest", async () => {
  const slowSave = deferred();
  const a = createBookmarkStore("a", knownIds, repo({ save: () => slowSave.promise }));
  const stopA = a.start();
  await Promise.resolve();
  const saving = a.toggle(123);
  stopA();
  const b = createBookmarkStore(
    "b",
    knownIds,
    repo({ list: async () => ["course:institution:456"] }),
  );
  const stopB = b.start();
  await Promise.resolve();
  slowSave.resolve();
  await saving;
  assert.deepEqual(savedIds(a), []);
  assert.deepEqual(savedIds(b), [456]);
  assert.deepEqual(savedIds(createBookmarkStore(null, knownIds, null)), []);
  stopB();
});
