import test from "node:test";
import assert from "node:assert/strict";
import { joinedOn, profileRepository, validateDisplayName } from "./profile.ts";
import {
  myPageAccess,
  readMyPageLocation,
  weeklyPreview,
  withMyPageLocation,
} from "./mypage-view.ts";

test("mypage location preserves auth parameters and survives a reload", () => {
  const current = new URL("https://example.com/?auth=recovery#token_hash=test");
  const myPage = withMyPageLocation(current, true);
  assert.ok(readMyPageLocation(new URL(myPage.href)));
  assert.equal(myPage.searchParams.get("auth"), "recovery");
  assert.equal(myPage.hash, "#token_hash=test");
  assert.equal(withMyPageLocation(myPage, false).href, current.href);
  assert.equal(
    withMyPageLocation(new URL("https://example.com/?view=other"), false).search,
    "?view=other",
  );
});

test("pending authentication takes priority over an account and guests remain gated", () => {
  assert.equal(myPageAccess(true, "owner"), "loading");
  assert.equal(myPageAccess(true, null), "loading");
  assert.equal(myPageAccess(false, null), "guest");
  assert.equal(myPageAccess(false, "owner"), "member");
});

test("nickname validation normalizes, enforces length and rejects unsafe text", () => {
  assert.deepEqual(validateDisplayName("  무브릿-5 _사용자 "), {
    name: "무브릿-5 _사용자",
    error: "",
  });
  assert.deepEqual(validateDisplayName("  "), { name: null, error: "" });
  assert.equal(validateDisplayName("Cafe\u0301").name, "Café");
  assert.equal(validateDisplayName("가".repeat(24)).error, "");
  for (const bad of ["가", "가".repeat(25), "<tag>", "이\n름", "ab\u202ecd", "--"])
    assert.ok(validateDisplayName(bad).error, bad);
});

test("profile created_at is formatted in Seoul time", () => {
  assert.equal(joinedOn("2026-11-24T16:00:00Z"), "2026. 11. 25.");
  assert.equal(joinedOn("invalid"), "확인할 수 없음");
});

test("weekly preview uses the existing weekdays and removes a deleted course from every day", () => {
  const reference = { title: "강좌", rawTime: "09:00-10:00", sport: "요가", audience: "", endDate: "9999-12-31" };
  const late = { ...reference, id: 1, days: [0, 1], rawTime: "18:00-19:00", start: 18, end: 19 };
  const early = { ...reference, id: 2, days: [0], start: 9, end: 10 };
  const week = weeklyPreview([late, early], ["월", "화", "수"]);
  assert.deepEqual(
    week.map((day) => day.courses.map(({ id }) => id)),
    [[2, 1], [1], []],
  );
  assert.deepEqual(
    weeklyPreview([early], ["월", "화"]).map((day) => day.courses.map(({ id }) => id)),
    [[2], []],
  );
});

test("profile repository scopes every query to the authenticated ID and updates only the nickname", async () => {
  const calls = [];
  const row = { display_name: "회원 A", created_at: "2026-11-24T16:00:00Z" };
  const signal = new AbortController().signal;
  const client = {
    from(table) {
      calls.push(["from", table]);
      const query = { single: async () => ({ data: row, error: null }) };
      for (const method of ["select", "update", "eq", "abortSignal"]) {
        query[method] = (...args) => {
          calls.push([method, ...args]);
          return query;
        };
      }
      return query;
    },
  };
  const repo = profileRepository(client, "member-a");
  assert.deepEqual(await repo.load(signal), row);
  assert.deepEqual(await repo.save("회원 A", signal), row);
  assert.deepEqual(
    calls.filter(([method]) => method === "update"),
    [["update", { display_name: "회원 A" }]],
  );
  assert.deepEqual(
    calls.filter(([method]) => method === "eq"),
    [
      ["eq", "id", "member-a"],
      ["eq", "id", "member-a"],
    ],
  );
  assert.deepEqual(
    calls.filter(([method]) => method === "abortSignal"),
    [
      ["abortSignal", signal],
      ["abortSignal", signal],
    ],
  );
});

test("profile read and update errors propagate without fabricating a row", async () => {
  const error = new Error("request failed");
  const query = {
    select() {
      return this;
    },
    update() {
      return this;
    },
    eq() {
      return this;
    },
    abortSignal() {
      return this;
    },
    single: async () => ({ data: null, error }),
  };
  const repo = profileRepository({ from: () => query }, "member-a");
  const signal = new AbortController().signal;
  await assert.rejects(repo.load(signal), error);
  await assert.rejects(repo.save("회원 A", signal), error);
});
