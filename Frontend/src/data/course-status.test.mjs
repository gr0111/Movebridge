import test from "node:test";
import assert from "node:assert/strict";
import { getCourseStatus, koreaDate } from "./course-status.ts";
import { getCourseDisplay } from "./course-display.ts";
import {
  courses,
  videos,
  onlineVideos,
  searchCourses,
  searchableCourses,
  excludedCourses,
  days,
} from "./search.ts";
import { rawCourses } from "./sample-data.ts";
import { searchDiscovery } from "./discovery.ts";
import { roadmapResults, initialRoadmap } from "../features/onboarding/roadmap.ts";
import { createBookmarkStore } from "../features/bookmarks/bookmark-store.ts";
import { courseContentKey } from "../features/bookmarks/content-key.ts";
import { weeklyPreview } from "../features/mypage/mypage-view.ts";
import {
  scheduleEntries,
  weekOf,
  workoutSummary,
} from "../features/workout-planner/planner-model.ts";

const checkedDate = "2026-11-27";
const dates = weekOf(checkedDate);
const pausedIds = [2007, 2019, 2031, 2040, 2043, 2046, 2049];
const conflictIds = [102, 134, 138];
const courseById = (id) => courses.find((course) => course.id === id);
const paused = pausedIds.map(courseById);
const conflicts = conflictIds.map(courseById);
const base = {
  mode: "offline",
  sport: "전체 종목",
  days: [],
  start: "00",
  end: "24",
  budget: Infinity,
};
const discoveryFilters = { ...base, field: "전체 분야", experience: "상관없음" };

test("the seven suspension flags leave all source records in public search and omit them from the roadmap", () => {
  assert.deepEqual(
    courses
      .filter((course) => getCourseStatus(course, checkedDate).pausedInSource)
      .map(({ id }) => id),
    pausedIds,
  );
  assert.deepEqual(
    searchCourses({ ...base, sport: "일시중지" }).map(({ id }) => id),
    pausedIds,
  );
  assert.ok(paused.every((course) => getCourseDisplay(course).rawTitle.includes("일시중지")));
  const recommendationIds = new Set(
    roadmapResults(initialRoadmap).courses.map(({ record }) => record.id),
  );
  assert.ok(pausedIds.every((id) => !recommendationIds.has(id)));
  assert.ok(recommendationIds.has(307));
});

test("pausing only suppresses generated course slots, not guest and member bookmark identities", async () => {
  const known = new Set(searchableCourses.map(({ id }) => id));
  const guest = createBookmarkStore(null, known, null);
  for (const id of pausedIds) await guest.toggle(id);
  assert.deepEqual([...guest.getSnapshot().ids], pausedIds);
  const keys = pausedIds.map(courseContentKey);
  assert.deepEqual(
    keys,
    pausedIds.map((id) => `course:institution:${id}`),
  );
  const a = createBookmarkStore("a", known, { list: async () => keys });
  const b = createBookmarkStore("b", known, { list: async () => [] });
  const stopA = a.start();
  const stopB = b.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([...a.getSnapshot().ids], pausedIds);
  assert.equal(b.getSnapshot().ids.size, 0);
  assert.deepEqual(scheduleEntries(paused, [], dates), []);
  assert.ok(weeklyPreview(paused, days, dates).every((day) => day.courses.length === 0));
  assert.ok(
    paused.every((record) =>
      getCourseStatus(record).scheduleHoldReasons(checkedDate).includes("원본에 일시중지 표기"),
    ),
  );
  stopA();
  stopB();
});

test("all three conflicting records keep their raw search times and are held even in weeks before their end dates", () => {
  assert.deepEqual(
    courses
      .filter((course) => getCourseStatus(course, checkedDate).timeConflicts.length)
      .map(({ id }) => id),
    conflictIds,
  );
  assert.deepEqual(
    conflicts.map((course) => [getCourseDisplay(course).timeConflicts, course.rawTime]),
    [
      [["17~20시"], "17:00-21:00"],
      [["17~20시"], "17:00-21:00"],
      [["17~20시"], "17:00-19:00"],
    ],
  );
  const until19 = new Set(
    searchCourses({ ...base, sport: "골프", start: "17", end: "19" }).map(({ id }) => id),
  );
  const until21 = new Set(
    searchCourses({ ...base, sport: "골프", start: "17", end: "21" }).map(({ id }) => id),
  );
  assert.ok(conflictIds.every((id) => until21.has(id)));
  assert.ok(!until19.has(102) && !until19.has(134) && until19.has(138));
  assert.deepEqual(scheduleEntries(conflicts, [], weekOf("2026-01-12")), []);
  assert.ok(
    conflicts.every((course) =>
      getCourseStatus(course).scheduleHoldReasons().includes("제목·수강시간 불일치"),
    ),
  );
});

test("ordinary end dates are inclusive per occurrence, including a week that crosses the end date", () => {
  const normal = courseById(1);
  const ending = { ...normal, days: [0, 2, 4], endDate: "2026-11-25" };
  assert.deepEqual(
    scheduleEntries([ending], [], dates).map(({ day }) => dates[day]),
    ["2026-11-23", "2026-11-25"],
  );
  assert.deepEqual(scheduleEntries([ending], [], weekOf("2026-12-01")), []);
  const preview = weeklyPreview([ending], days, dates);
  assert.deepEqual(
    preview.filter(({ courses }) => courses.length).map(({ day }) => day),
    ["월", "수"],
  );
  assert.equal(scheduleEntries([normal], [], dates).length, normal.days.length);
});

test("record end classification uses the Korea date and never interprets the sentinel as an actual end", () => {
  const before = koreaDate(new Date("2026-01-31T14:59:59Z"));
  const after = koreaDate(new Date("2026-01-31T15:00:00Z"));
  assert.equal(before, "2026-01-31");
  assert.equal(after, "2026-02-01");
  const bounded = { ...courseById(1), endDate: "2026-01-31" };
  assert.equal(getCourseStatus(bounded, before).endedInRecord, false);
  assert.equal(getCourseStatus(bounded, after).endedInRecord, true);
  const special = getCourseStatus(courseById(1), after);
  assert.equal(special.specialEnd, true);
  assert.equal(special.recordEndDate, null);
  assert.match(special.endLabel, /^종료일 확인 불가/);
  assert.deepEqual(special.scheduleHoldReasons(), []);
  assert.equal(getCourseStatus({ ...bounded, endDate: "2026-02-31" }, after).recordEndDate, null);
  assert.equal(special.availability, "공개 강좌 기록 · 현재 운영·모집 미확인");
  assert.equal(
    courses.filter((course) => getCourseStatus(course, checkedDate).specialEnd).length,
    380,
  );
  assert.equal(
    courses.filter((course) => getCourseStatus(course, checkedDate).endedInRecord).length,
    20,
  );
});

test("program tags use explicit wording and employee records are discoverable without general recommendations", () => {
  const employee = courseById(1662);
  assert.ok(getCourseDisplay(employee).additionalTypes.includes("임직원 전용"));
  assert.ok(searchCourses({ ...base, sport: "임직원" }).includes(employee));
  assert.ok(
    !roadmapResults(initialRoadmap).courses.some(({ record }) => record.id === employee.id),
  );
  const free = courseById(2137);
  assert.ok(getCourseDisplay(free).additionalTypes.includes("자유이용"));
  assert.equal(getCourseStatus(free).canRecommend, false);
  const normal = courseById(1);
  assert.ok(
    getCourseDisplay({ ...normal, title: "개인 자유운동" }).additionalTypes.includes(
      "개인 자유운동",
    ),
  );
  assert.ok(!getCourseStatus(courseById(28)).program.freeUse);
  assert.ok(!getCourseStatus({ ...normal, title: "일반 수업 (임직원 할인)" }).program.employeeOnly);
  assert.ok(getCourseDisplay(courseById(307)).additionalTypes.includes("방학특강"));
});

test("personal workouts and dated completion records survive a fully held course list", () => {
  const plan = Object.freeze({
    id: "personal-a",
    title: "개인 운동",
    day_of_week: 2,
    start_time: "15:00",
    end_time: "15:30",
    note: null,
  });
  const completion = Object.freeze({ plan_id: plan.id, performed_on: "2026-11-25" });
  const entries = scheduleEntries([...paused, ...conflicts], [plan], dates);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "personal");
  assert.equal(entries[0].source, plan);
  const summary = workoutSummary([plan], [completion], new Date("2026-11-27T09:00:00Z"));
  assert.equal(summary.completed, 1);
  assert.equal(summary.recent[0].performed_on, completion.performed_on);
});

test("the original date fields are read as-is and public search, ordering and source totals stay intact", () => {
  assert.ok(
    courses.every(
      (course, index) =>
        course.startDate === rawCourses[index].수강시작일 &&
        course.endDate === rawCourses[index].수강종료일,
    ),
  );
  assert.deepEqual(
    [
      courses.length,
      searchableCourses.length,
      videos.length,
      onlineVideos.filter((row) => row.source === "youtube").length,
      onlineVideos.length,
    ],
    [400, 399, 56, 131, 187],
  );
  assert.deepEqual(
    excludedCourses.map(({ id }) => id),
    [2137],
  );
  const result = searchDiscovery({ ...discoveryFilters, sport: "실내승마" }, "price");
  assert.ok(pausedIds.every((id) => result.offline.some((row) => row.id === id)));
  assert.ok(
    result.offline.every((row, index, rows) => index === 0 || rows[index - 1].price <= row.price),
  );
});
