import test from "node:test";
import assert from "node:assert/strict";
import {
  initialRoadmap,
  moveRoadmap,
  originalVideoLink,
  roadmapFields,
  roadmapResults,
  roadmapSports,
  updateRoadmap,
} from "./roadmap.ts";
import {
  interestFields,
  experienceOptions,
  searchDiscovery,
  analyzeBeginnerTitle,
} from "../../data/discovery.ts";
import { courses, onlineVideos, searchableCourses, videos } from "../../data/search.ts";
import { discoveryDistribution } from "../../data/public-data-analysis.ts";
import { createBookmarkStore } from "../bookmarks/bookmark-store.ts";
import { courseContentKey, videoContentKey } from "../bookmarks/content-key.ts";
import { scheduleEntries, workoutSummary } from "../workout-planner/planner-model.ts";

const conditions = (field, sport, experience = "상관없음") => ({
  ...initialRoadmap,
  field,
  sport,
  experience,
});
const keyFor = (row) => `${row.record.source ?? "course"}:${row.record.id}`;

test("roadmap options reuse all search fields and experience levels and include populated analytic fields", () => {
  assert.ok(interestFields.every((field) => roadmapFields.includes(field)));
  for (const field of ["라켓 스포츠", "구기 스포츠", "무도·격투 스포츠", "골프", "당구", "승마"])
    assert.ok(roadmapFields.includes(field));
  assert.ok(!roadmapFields.includes("분류 확인 필요") && !roadmapFields.includes("운동 외 콘텐츠"));
  for (const experience of experienceOptions)
    assert.equal(updateRoadmap(initialRoadmap, { experience }).experience, experience);
  assert.deepEqual(roadmapSports("라켓 스포츠"), ["배드민턴", "탁구", "테니스"]);
  assert.ok(roadmapSports("유연성·스트레칭").includes("필라테스"));
  assert.ok(!roadmapSports("전체 분야").includes("방학특강"));
});

test("step navigation keeps conditions and incompatible sports reset when the field changes", () => {
  const selection = updateRoadmap(initialRoadmap, {
    field: "유연성·스트레칭",
    sport: "필라테스",
    experience: "처음 시작",
  });
  const final = moveRoadmap(moveRoadmap(selection, 1), 3);
  assert.deepEqual(moveRoadmap(final, 0), selection);
  assert.equal(moveRoadmap(final, 20).step, 3);
  assert.equal(moveRoadmap(final, -1).step, 0);
  assert.equal(updateRoadmap(selection, { field: "전체 분야" }).sport, "필라테스");
  assert.equal(updateRoadmap(selection, { field: "골프" }).sport, "전체 종목");
  assert.equal(updateRoadmap(selection, { sport: "없는 종목" }).sport, "전체 종목");
});

test("confirmed sport matches precede inferred matches and related fields", () => {
  const result = roadmapResults(conditions("기타 운동", "배드민턴", "처음 시작"));
  const direct = result.courses.filter((row) => row.relationship === "sport");
  const inferred = direct.filter((row) => row.inferred);
  assert.deepEqual(
    inferred.map((row) => row.record.id),
    [307, 309],
  );
  assert.deepEqual(result.courses.slice(0, direct.length), direct);
  assert.deepEqual(direct.slice(-inferred.length), inferred);
  assert.ok(result.courses.every((row) => row.field === "라켓 스포츠"));
  assert.ok(result.courses.some((row) => row.sport === "테니스" && row.relationship === "field"));
  assert.ok(inferred.every((row) => row.record.sport === "방학특강"));
});

test("institution and YouTube sports from real classifications join without changing source records", () => {
  const result = roadmapResults(conditions("유연성·스트레칭", "필라테스", "처음 시작"));
  const exact = result.videos.filter((row) => row.relationship === "sport");
  assert.ok(exact.some((row) => row.record.source === "institution" && row.record.id === 272));
  assert.ok(exact.some((row) => row.record.source === "youtube"));
  assert.ok(exact.every((row) => row.sport === "필라테스"));
  assert.ok(result.videos.some((row) => row.sport !== "필라테스" && row.relationship === "field"));
  assert.ok(result.courses.some((row) => row.sport === "필라테스" && row.relationship === "sport"));
  assert.ok(result.videos.every((row) => onlineVideos.includes(row.record)));
  assert.ok(result.courses.every((row) => searchableCourses.includes(row.record)));
  const strength = roadmapResults(conditions("근력·체력 향상", "근력운동"));
  assert.ok(strength.videos.some((row) => row.record.id === 242 && row.sport === "근력운동"));
  assert.ok(
    !roadmapResults(conditions("골프", "골프")).videos.some((row) => row.record.id === 242),
  );
});

test("experience affects rank while preserving available content and title-analysis rules", () => {
  const base = conditions("근력·체력 향상", "전체 종목");
  const any = roadmapResults(base).videos;
  const novice = roadmapResults({ ...base, experience: "처음 시작" }).videos;
  const experienced = roadmapResults({ ...base, experience: "운동 경험 있음" }).videos;
  assert.ok(novice[0].introductoryTitle);
  assert.ok(novice.some((row) => !row.introductoryTitle));
  assert.ok(["중급", "고급"].includes(experienced[0].record.experience));
  assert.deepEqual(new Set(any.map(keyFor)), new Set(novice.map(keyFor)));
  assert.deepEqual(new Set(any.map(keyFor)), new Set(experienced.map(keyFor)));
  assert.ok(
    novice.every(
      (row) => row.introductoryTitle === analyzeBeginnerTitle(row.record.title).hasBeginnerKeyword,
    ),
  );
  assert.equal(analyzeBeginnerTitle("기초 체력과 기초대사량").hasBeginnerKeyword, false);
});

test("an absent content type or an unsupported sport produces an honest empty result", () => {
  assert.equal(roadmapResults(conditions("라켓 스포츠", "배드민턴")).videos.length, 0);
  assert.equal(roadmapResults(conditions("수영·수중운동", "수영")).courses.length, 0);
  assert.deepEqual(roadmapResults(conditions("전체 분야", "등산 종목 없음")), {
    videos: [],
    courses: [],
  });
});

test("unknown classifications and event or promotional videos stay out of training recommendations", () => {
  const result = roadmapResults(initialRoadmap);
  const institution = result.videos.filter((row) => row.record.source === "institution");
  const excluded = [304, 291, 290, 256, 240, 235, 232, 319, 254, 228, 225, 221, 219, 246, 237, 222];
  assert.equal(institution.length, 40);
  assert.ok(institution.every((row) => !excluded.includes(row.record.id)));
  assert.deepEqual(
    result.courses.filter((row) => [2073, 2077, 2086, 2137].includes(row.record.id)),
    [],
  );
});

test("ordering is stable and missing video URLs do not become in-page links", () => {
  const state = conditions("유연성·스트레칭", "요가", "처음 시작");
  const a = roadmapResults(state);
  assert.deepEqual(a, roadmapResults(state));
  assert.equal(new Set(a.videos.map(keyFor)).size, a.videos.length);
  for (const value of [null, "", " ", "/missing", "javascript:;", "unparseable"])
    assert.equal(originalVideoLink(value), null);
  assert.ok(onlineVideos.every((record) => originalVideoLink(record.url) === record.url));
});

test("roadmap guest bookmarks use existing content keys and only courses feed the timetable", async () => {
  const picks = roadmapResults(conditions("유연성·스트레칭", "필라테스"));
  const course = picks.courses[0].record;
  const video = picks.videos[0].record;
  const key = videoContentKey(video);
  const guest = createBookmarkStore(null, new Set([course.id]), null, new Set([key]));
  await guest.toggle(course.id);
  await guest.toggle(key);
  const state = guest.getSnapshot();
  assert.deepEqual([...state.videoKeys], [key]);
  assert.deepEqual([...state.ids], [course.id]);
  const timetable = scheduleEntries(
    courses.filter((row) => state.ids.has(row.id)),
    [],
  );
  assert.ok(
    timetable.length &&
      timetable.every((entry) => entry.kind === "course" && entry.source.id === course.id),
  );
  assert.equal(workoutSummary([], []).completed, 0);
  await guest.toggle(key);
  assert.equal(guest.getSnapshot().videoKeys.size, 0);
});

test("roadmap-selected items restore from member bookmarks and stay isolated across stores", async () => {
  const picks = roadmapResults(conditions("유연성·스트레칭", "필라테스"));
  const id = picks.courses[0].record.id;
  const key = videoContentKey(picks.videos[0].record);
  const a = createBookmarkStore(
    "a",
    new Set([id]),
    { list: async () => [courseContentKey(id), key] },
    new Set([key]),
  );
  const b = createBookmarkStore("b", new Set([id]), { list: async () => [] }, new Set([key]));
  a.start();
  b.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(a.getSnapshot().ids.has(id) && a.getSnapshot().videoKeys.has(key));
  assert.equal(b.getSnapshot().ids.size + b.getSnapshot().videoKeys.size, 0);
});

test("roadmap leaves existing search and public stats data intact", () => {
  const query = {
    ...conditions("유연성·스트레칭", "필라테스", "처음 시작"),
    mode: "all",
    days: [],
    start: "00",
    end: "24",
    budget: Infinity,
  };
  const old = searchDiscovery(query);
  roadmapResults(query);
  assert.deepEqual(searchDiscovery(query), old);
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
  assert.equal(discoveryDistribution.find(({ field }) => field === "라켓 스포츠").offline, 171);
});
