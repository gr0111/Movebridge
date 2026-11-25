import test from "node:test";
import assert from "node:assert/strict";
import { courses, videos, onlineVideos, searchableCourses } from "../../data/search.ts";
import { discoveryDistribution } from "../../data/public-data-analysis.ts";
import {
  addDays,
  dateWeekday,
  dayLayout,
  koreaDate,
  scheduleEntries,
  validateWorkoutDraft,
  weekOf,
  workoutSummary,
} from "./planner-model.ts";
import { createPlannerStore } from "./planner-store.ts";

const monday = "2026-11-23";
const nextMonday = "2026-11-30";
const draft = {
  title: "홈트레이닝",
  day_of_week: 0,
  start_time: "19:00",
  end_time: "19:40",
  note: "",
};
const plan = (id, changes = {}) => ({ ...draft, id, note: null, ...changes });
const record = (id, date) => ({ plan_id: id, performed_on: date });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((done) => setImmediate(done));

function memoryRepository(initial = { plans: [], completions: [] }) {
  let data = structuredClone(initial);
  return {
    list: async () => structuredClone(data),
    async save(id, fields) {
      const result = { id, ...fields };
      data.plans = [...data.plans.filter((item) => item.id !== id), result];
      return result;
    },
    async remove(id) {
      data.plans = data.plans.filter((plan) => plan.id !== id);
      data.completions = data.completions.filter((item) => item.plan_id !== id);
    },
    async setCompletion(id, date, selected) {
      data.completions = data.completions.filter(
        (item) => item.plan_id !== id || item.performed_on !== date,
      );
      if (selected) data.completions.push(record(id, date));
    },
  };
}

test("draft validation trims text and rejects missing names, excess length, invalid weekdays and time ranges", () => {
  assert.deepEqual(validateWorkoutDraft({ ...draft, title: "  운동 \n", note: "  " }).fields, {
    ...draft,
    title: "운동",
    note: null,
  });
  for (const values of [
    { title: " \t " },
    { title: "운".repeat(81) },
    { note: "글".repeat(501) },
    { day_of_week: -1 },
    { day_of_week: 7 },
    { day_of_week: 1.5 },
    { day_of_week: NaN },
    { start_time: "" },
    { start_time: "19:30:00" },
    { end_time: "19:00" },
    { end_time: "24:00" },
    { start_time: "23:00", end_time: "01:00" },
  ])
    assert.ok(validateWorkoutDraft({ ...draft, ...values }).error, JSON.stringify(values));
  assert.ok(
    validateWorkoutDraft({
      ...draft,
      title: "🏃".repeat(80),
      start_time: "00:00",
      end_time: "00:01",
    }).fields,
  );
});

test("Korea dates switch at 15:00 UTC and date-only week navigation handles year and leap boundaries", () => {
  assert.equal(koreaDate(new Date("2026-11-22T14:59:59Z")), "2026-11-22");
  assert.equal(koreaDate(new Date("2026-11-22T15:00:00Z")), monday);
  assert.deepEqual(weekOf("2026-01-01"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  for (const invalid of [
    "2026-02-29",
    "2026-11-31",
    "2026-11-23T00:00:00Z",
    "2026-1-2",
    "0000-01-01",
  ])
    assert.equal(dateWeekday(invalid), null);
  assert.equal(dateWeekday(monday), 0);
  assert.equal(dateWeekday("2026-11-29"), 6);
});

test("plan mutations persist and deletion removes only that plan's completion history", async () => {
  const repo = memoryRepository();
  const a = createPlannerStore(repo);
  const stop = a.start();
  await flush();
  assert.equal(await a.save("1", draft, false), true);
  assert.equal(await a.save("2", draft, false), true);
  assert.deepEqual(
    a.getSnapshot().plans.map((item) => item.id),
    ["1", "2"],
  );
  await a.setCompletion("1", monday, true);
  await a.setCompletion("2", monday, true);
  await a.save("1", { ...draft, title: "수정한 운동", day_of_week: 1, note: "새 메모" }, true);
  assert.equal(a.getSnapshot().plans.find((item) => item.id === "1").title, "수정한 운동");
  assert.deepEqual(a.getSnapshot().completions, [record("1", monday), record("2", monday)]);
  await a.remove("1");
  stop();
  const restored = createPlannerStore(repo);
  const stopRestored = restored.start();
  await flush();
  assert.deepEqual(restored.getSnapshot().plans, [plan("2")]);
  assert.deepEqual(restored.getSnapshot().completions, [record("2", monday)]);
  stopRestored();
});

test("planner does not create duplicate or shifted-date completions and cancels dates independently", async () => {
  const store = createPlannerStore(memoryRepository({ plans: [plan("id")], completions: [] }));
  const stop = store.start();
  await flush();
  assert.throws(() => store.setCompletion("id", "2026-11-24", true), /weekday/);
  assert.throws(() => store.setCompletion("id", "2026-02-29", true), /weekday/);
  await store.setCompletion("id", monday, true);
  await store.setCompletion("id", monday, true);
  await store.setCompletion("id", nextMonday, true);
  assert.deepEqual(store.getSnapshot().completions, [
    record("id", monday),
    record("id", nextMonday),
  ]);
  await store.save("id", { ...draft, day_of_week: 2 }, true);
  await store.setCompletion("id", monday, false);
  assert.deepEqual(store.getSnapshot().completions, [record("id", nextMonday)]);
  stop();
});

test("failed mutations retain existing data, release the busy lock and can retry", async () => {
  const repo = memoryRepository({ plans: [plan("id")], completions: [record("id", monday)] });
  const remove = repo.remove;
  repo.remove = async () => {
    throw new Error("network");
  };
  const store = createPlannerStore(repo);
  const stop = store.start();
  await flush();
  await assert.rejects(store.remove("id"), /network/);
  assert.deepEqual(store.getSnapshot().plans, [plan("id")]);
  assert.deepEqual(store.getSnapshot().completions, [record("id", monday)]);
  assert.equal(store.getSnapshot().pending.size, 0);
  repo.remove = remove;
  assert.equal(await store.remove("id"), true);
  assert.deepEqual(store.getSnapshot().completions, []);
  stop();
});

test("two concurrent plans retain both server results and a repeated submission is ignored", async () => {
  const wait = deferred();
  let calls = 0;
  const repo = memoryRepository();
  repo.save = async (id, fields) => {
    calls++;
    await wait.promise;
    return { id, ...fields };
  };
  const store = createPlannerStore(repo);
  const stop = store.start();
  await flush();
  const first = store.save("1", draft, false);
  const second = store.save("2", draft, false);
  assert.equal(await store.save("1", draft, false), false);
  assert.equal(calls, 2);
  assert.deepEqual(store.getSnapshot().plans, []);
  wait.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(
    store.getSnapshot().plans.map((item) => item.id),
    ["1", "2"],
  );
  stop();
});

test("stores separate guest, a new account and late reads or writes from previous scopes", async () => {
  const wait = deferred();
  let signal;
  const repo = memoryRepository({ plans: [plan("A")], completions: [] });
  repo.save = async (_, fields, __, request) => {
    signal = request;
    await wait.promise;
    return { id: "late", ...fields };
  };
  const accountA = createPlannerStore(repo);
  const stopA = accountA.start();
  await flush();
  const original = accountA.save("late", draft, false);
  stopA();
  const accountB = createPlannerStore(memoryRepository({ plans: [plan("B")], completions: [] }));
  const stopB = accountB.start();
  const guest = createPlannerStore(null);
  assert.equal(guest.getSnapshot().status, "guest");
  assert.deepEqual(guest.getSnapshot().plans, []);
  assert.equal(signal.aborted, true);
  wait.resolve();
  assert.equal(await original, false);
  await flush();
  assert.deepEqual(accountB.getSnapshot().plans, [plan("B")]);
  stopB();

  const lateRead = deferred();
  const reading = createPlannerStore({ ...memoryRepository(), list: () => lateRead.promise });
  reading.start()();
  lateRead.resolve({ plans: [plan("old")], completions: [record("old", monday)] });
  await flush();
  assert.deepEqual(reading.getSnapshot().plans, []);
});

test("load errors differ from a genuine empty account and can retry", async () => {
  const repo = memoryRepository();
  const list = repo.list;
  repo.list = async () => {
    throw new Error("offline");
  };
  const store = createPlannerStore(repo);
  const stop = store.start();
  await flush();
  assert.equal(store.getSnapshot().status, "error");
  repo.list = list;
  store.retry();
  await flush();
  assert.equal(store.getSnapshot().status, "ready");
  assert.deepEqual(store.getSnapshot().plans, []);
  stop();
});

test("public courses remain intact and chained overlaps receive independent visible lanes", () => {
  const course = courses.find(
    (item) => item.days.includes(0) && item.start === 18 && item.end === 19.5,
  );
  assert.ok(course);
  const original = structuredClone(course);
  const entries = scheduleEntries(
    [course],
    [plan("1"), plan("2", { start_time: "19:35", end_time: "20:40" })],
  );
  const mondayLayout = dayLayout(entries.filter((item) => item.day === 0));
  assert.equal(mondayLayout.overlaps, true);
  assert.deepEqual(
    mondayLayout.positioned.map(({ entry, lane, lanes }) => [entry.kind, lane, lanes]),
    [
      ["course", 0, 2],
      ["personal", 1, 2],
      ["personal", 0, 2],
    ],
  );
  assert.deepEqual(course, original);
  assert.deepEqual(
    entries.filter((item) => item.kind === "course").map((item) => item.day),
    course.days,
  );
});

test("minimum-height events occupy distinct lanes without falsely reporting clock overlap", () => {
  const first = plan("1", { start_time: "19:00", end_time: "19:05" });
  const second = plan("2", { start_time: "19:05", end_time: "19:10" });
  const layout = dayLayout(scheduleEntries([], [first, second]));
  assert.equal(layout.overlaps, false);
  assert.deepEqual(
    layout.positioned.map(({ lane, lanes }) => [lane, lanes]),
    [
      [0, 2],
      [1, 2],
    ],
  );
});

test("weekly completion rate counts only current plan occurrences and recent history is preserved", () => {
  const now = new Date("2026-11-25T03:00:00Z");
  const plans = [plan("1"), plan("2", { day_of_week: 1 })];
  const completions = [record("1", monday), record("1", nextMonday), record("2", monday)];
  const summary = workoutSummary(plans, completions, now);
  assert.deepEqual([summary.planned, summary.completed, summary.rate], [2, 1, 50]);
  assert.equal(summary.recent[0].performed_on, nextMonday);
  assert.equal(workoutSummary([], [], now).rate, 0);
});

test("the planner leaves public counts and classification unchanged", () => {
  assert.deepEqual(
    [
      courses.length,
      searchableCourses.length,
      videos.length,
      onlineVideos.length - videos.length,
      onlineVideos.length,
    ],
    [400, 399, 56, 131, 187],
  );
  assert.deepEqual(discoveryDistribution.find(({ field }) => field === "라켓 스포츠").offline, 171);
  assert.equal(discoveryDistribution.find(({ field }) => field === "기타 운동").offline, 0);
});
