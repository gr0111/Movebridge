import test from "node:test";
import assert from "node:assert/strict";
import { rawCourses, rawVideos } from "./sample-data.ts";
import {
  courses,
  videos,
  searchCourses,
  searchVideos,
  searchRelatedVideos,
  sampleCharts,
  searchableCourses,
} from "./search.ts";

const all = { mode: "all", sport: "전체 종목", days: [], start: "06", end: "22", budget: 1000000 };

test("every displayed record maps to the attached sample without rewriting source values", () => {
  assert.equal(courses.length, 400);
  assert.equal(videos.length, 56);
  for (const [index, course] of courses.entries()) {
    const raw = rawCourses[index];
    assert.equal(course.title, raw.강좌명);
    assert.equal(course.sport, raw.종목 || "미기재");
    assert.equal(course.rawDays, raw.수강요일);
    assert.equal(course.rawTime, raw.수강시간);
    assert.equal(course.price, Number(raw.수강금액));
    assert.equal(course.month, raw.수강월);
    assert.equal(course.audience, raw.수강대상 || "미기재");
  }
  for (const [index, video] of videos.entries()) {
    const raw = rawVideos[index];
    assert.equal(video.title, raw.제목);
    assert.equal(video.date, raw.등록일);
    assert.equal(video.sport, raw.관심분야);
    assert.equal(video.type, raw.콘텐츠유형);
    assert.equal(video.url, raw.영상링크);
    assert.equal(new URL(video.url).protocol, "https:");
  }
});

test("unrestricted filters return all eligible records while preserving all raw records", () => {
  assert.equal(searchCourses(all).length, searchableCourses.length);
  assert.equal(courses.length, 400);
});

test("unmatched titles and impossible budgets return no fabricated records", () => {
  assert.deepEqual(searchCourses({ ...all, sport: "존재하지않는강좌" }), []);
  assert.deepEqual(searchCourses({ ...all, budget: 0 }), []);
  assert.deepEqual(searchVideos("존재하지않는영상"), []);
  assert.deepEqual(searchRelatedVideos("존재하지않는영상"), []);
});

test("weekday, time and amount filters all apply to offline records", () => {
  const filters = { ...all, sport: "검도", days: [0, 1], start: "18", end: "20", budget: 70000 };
  const results = searchCourses(filters);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "검도 1800-1930 (월화목금) 청소년");
  assert.equal(results[0].audience, "미기재");
  assert.deepEqual(searchCourses({ ...filters, days: [5] }), []);
  assert.equal(results[0].rawDays, "월,화,목,금,(토)");
  assert.equal(results[0].parentheticalDays, "토");
  assert.equal(results[0].end, 19.5);
});

test("videos are searched independently of offline constraints", () => {
  assert.equal(searchVideos("전체 종목").length, 187);
  assert.ok(searchVideos("헬스").some((video) => video.title === "헬스PT"));
  assert.ok(searchVideos("근력·체력 향상").length > 0);
  assert.ok(videos.some((video) => video.type === "접수·신청 안내 후보"));
});

test("related-field videos remain separate from direct matches", () => {
  const direct = searchVideos("요가");
  const related = searchRelatedVideos("요가");
  assert.ok(related.every((video) => video.sport === "유연성·스트레칭"));
  assert.ok(related.every((video) => !direct.some((match) => match.id === video.id)));
});

test("sample charts use actual records and exclude parenthetical days", () => {
  for (const index of [0, 1, 3]) {
    assert.equal(
      sampleCharts[index].values.reduce((sum, value) => sum + value, 0),
      400,
    );
  }
  assert.deepEqual(
    sampleCharts[2].values,
    Array.from(
      { length: 7 },
      (_, index) => courses.filter((course) => course.days.includes(index)).length,
    ),
  );
});
