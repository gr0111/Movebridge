import test from "node:test";
import assert from "node:assert/strict";
import { onlineVideos } from "../../data/search.ts";
import {
  courseContentKey,
  isVideoContentKey,
  matchBookmarks,
  videoContentKey,
} from "./content-key.ts";
import { createBookmarkStore } from "./bookmark-store.ts";

const institution = videoContentKey({ source: "institution", id: 1 });
const youtube = videoContentKey({ source: "youtube", id: "MB-C001", youtubeId: "public-id" });
const known = new Set([institution, youtube]);
const base = {
  list: async () => [],
  save: async () => {},
  remove: async () => {},
  removeUnavailable: async () => {},
};

test("all 187 videos have distinct SQL-compatible keys using source IDs", () => {
  assert.equal(institution, "video:institution:1");
  assert.equal(youtube, "video:youtube:MB-C001");
  assert.notEqual(institution, courseContentKey(1));
  const keys = onlineVideos.map(videoContentKey);
  assert.equal(new Set(keys).size, 187);
  assert.ok(keys.every((key) => key && isVideoContentKey(key)));
});

test("video writes reject malformed keys and the original YouTube playback ID", () => {
  for (const key of [
    "video:youtube:GX4ttLAOUGY",
    "video:institution:-1",
    "video:institution:01",
    "video:institution:9007199254740992",
    "course:institution:1",
  ])
    assert.equal(isVideoContentKey(key), false);
});

test("saved courses and videos are grouped separately, leaving unknown video keys intact", () => {
  const missing = "video:youtube:MB-C999999";
  const { ids, videoKeys, unavailable } = matchBookmarks(
    [institution, courseContentKey(1), youtube, youtube, missing],
    new Set([1]),
    known,
  );
  assert.deepEqual([...ids], [1]);
  assert.deepEqual([...videoKeys], [institution, youtube]);
  assert.deepEqual([...unavailable], [missing]);
});

test("video changes wait for success, guard concurrent clicks and preserve course state", async () => {
  let finish;
  const request = new Promise((resolve) => {
    finish = resolve;
  });
  let saves = 0;
  const store = createBookmarkStore(
    "a",
    new Set([1]),
    {
      ...base,
      list: async () => [courseContentKey(1), institution],
      save: () => {
        saves++;
        return request;
      },
      remove: async () => {
        throw new Error("test failure");
      },
    },
    known,
  );
  const stop = store.start();
  await Promise.resolve();
  const saving = store.toggle(youtube);
  await store.toggle(youtube);
  assert.equal(saves, 1);
  assert.equal(store.getSnapshot().videoKeys.has(youtube), false);
  finish();
  await saving;
  assert.equal(store.getSnapshot().videoKeys.has(youtube), true);
  await store.toggle(youtube);
  assert.equal(store.getSnapshot().videoKeys.has(youtube), true);
  assert.match(store.getSnapshot().errors.get(youtube), /영상/);
  assert.deepEqual([...store.getSnapshot().ids], [1]);
  stop();
});

test("guest video bookmarks do not call the server or carry into a member scope", async () => {
  const guest = createBookmarkStore(null, new Set([1]), null, known);
  await guest.toggle(youtube);
  assert.deepEqual([...guest.getSnapshot().videoKeys], [youtube]);
  const member = createBookmarkStore("a", new Set([1]), base, known);
  const stop = member.start();
  await Promise.resolve();
  assert.deepEqual([...member.getSnapshot().videoKeys], []);
  stop();
});
