import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalSport, linkedVideos, linkableVideos, otherExerciseFields, sportTopics,
  topicRelationship, videoTitleIntroTerms,
} from "./content-linkage.ts";
import { COURSE_LOAD_MORE_SIZE, COURSE_PAGE_SIZE, visibleCourseRecords } from "./course-pagination.ts";
import { getCourseDisplay } from "./course-display.ts";
import { getCourseStatus } from "./course-status.ts";
import { courseDiscovery, getDetailOptions, searchDiscovery, updateDiscoveryFilter } from "./discovery.ts";
import { courses, onlineVideos, searchableCourses, videos } from "./search.ts";
import { initialRoadmap, roadmapResults } from "../features/onboarding/roadmap.ts";

const filters = {
  mode: "all", field: "전체 분야", sport: "전체 종목", experience: "상관없음",
  days: [], start: "06", end: "22", budget: Infinity,
};
const ids = (rows) => rows.map(({ id }) => id);

test("the six analysis fields partition exactly the 350 legacy other-sport IDs", () => {
  assert.deepEqual(ids(searchDiscovery(filters).offline), ids(searchableCourses));
  assert.equal(courses.length, 400);
  assert.equal(searchableCourses.length, 399);
  const legacy = searchDiscovery({ ...filters, field: "기타 운동" }).offline;
  const byField = otherExerciseFields.map((field) => searchDiscovery({ ...filters, field }).offline);
  assert.deepEqual(byField.map((records) => records.length), [171, 81, 70, 17, 6, 5]);
  assert.equal(legacy.length, 350);
  assert.equal(new Set(ids(byField.flat())).size, 350);
  assert.deepEqual(ids(byField.flat()).sort((a, b) => a - b), ids(legacy));
  for (const course of courses) {
    const { sport } = courseDiscovery.get(course.id);
    if (sport) assert.equal(getCourseDisplay(course).displaySport, sport, `course ${course.id}`);
  }
});

test("compatibility fields preserve valid canonical details, other controls, and cumulative order", () => {
  const selection = { ...filters, field: "기타 운동", sport: "배드민턴", experience: "처음 시작", days: [0] };
  const compatible = updateDiscoveryFilter(selection, "field", "라켓 스포츠");
  assert.deepEqual(compatible, { ...selection, field: "라켓 스포츠" });
  const incompatible = updateDiscoveryFilter(compatible, "field", "당구");
  assert.deepEqual(incompatible, { ...compatible, field: "당구", sport: "전체 종목" });
  assert.deepEqual(new Set(getDetailOptions({ field: "라켓 스포츠", mode: "offline" }).sports),
    new Set(["배드민턴", "탁구", "테니스"]));
  const records = searchDiscovery({ ...filters, field: "라켓 스포츠" }, "price").offline;
  let previous = [];
  for (let click = 0; click < 4; click++) {
    const limit = COURSE_PAGE_SIZE + COURSE_LOAD_MORE_SIZE * click;
    const shown = visibleCourseRecords(records, limit);
    assert.equal(shown.length, [9, 30, 51, 72][click]);
    assert.deepEqual(shown.slice(0, previous.length), previous);
    previous = shown;
  }
});

test("both holiday records are inferred badminton with explicit raw evidence and retain their IDs", () => {
  const result = searchDiscovery({ ...filters, field: "라켓 스포츠", sport: "배드민턴" });
  const inferred = result.offline.filter(({ id }) => courseDiscovery.get(id).inferred);
  assert.deepEqual(ids(inferred), [307, 309]);
  assert.ok(inferred.every((row) => row.sport === "방학특강" && row.title.includes("방특 배민")));
  assert.ok(inferred.every(({ id }) => courseDiscovery.get(id).evidence.includes("공식 약어 해석은 확인되지")));
  const needsReview = searchableCourses.filter(({ id }) => courseDiscovery.get(id).field === "분류 확인 필요");
  assert.equal(needsReview.length, 3);
  assert.ok(needsReview.every(({ id }) => !result.offline.some((row) => row.id === id)));
  assert.equal(result.hasVideoPath, false);
});

test("topic matching requires both fields, preserves explicit Zumba equivalence, and keeps related activities distinct", () => {
  assert.equal(canonicalSport("줌바"), "줌바댄스");
  const zumba = searchDiscovery({ ...filters, field: "리듬·댄스", sport: "줌바댄스" });
  assert.equal(zumba.offline.length, 2);
  assert.equal(zumba.sameSport.length, 8);
  assert.ok(zumba.sameSport.every((row) => row.source === "youtube" && row.discipline === "줌바" && row.experience === "판단 보류"));
  assert.deepEqual(searchDiscovery({ ...filters, field: "리듬·댄스", sport: "줌바" }).sameSport, zumba.sameSport);
  const roadCycling = searchDiscovery({ ...filters, field: "유산소·러닝·사이클", sport: "로드사이클" });
  assert.equal(roadCycling.sameSport.length, 0);
  assert.ok(roadCycling.sameField.some(({ title }) => title === "스피닝"));
  const gym = searchDiscovery({ ...filters, field: "근력·체력 향상", sport: "헬스" });
  assert.equal(gym.sameSport.length, 3);
  assert.ok(gym.sameField.some((row) => row.source === "youtube" && row.discipline === "헬스장 루틴"));
  assert.equal(topicRelationship({ field: "골프", sport: "근력운동" }, sportTopics("근력운동", "전체 분야")), null);
});

test("eligible video coverage reproduces Phase 2 exact, field-only, and missing paths", () => {
  const confirmed = searchableCourses.filter(({ id }) => {
    const topic = courseDiscovery.get(id);
    return topic.sport && !topic.inferred;
  });
  assert.equal(confirmed.length, 394);
  const unique = [...new Map(confirmed.map(({ id }) => {
    const { field, sport } = courseDiscovery.get(id);
    return [`${field}/${sport}`, { field, sport }];
  })).values()];
  assert.equal(unique.length, 19);
  const paths = unique.map((topic) => ({ ...topic, ...linkedVideos([topic]) }));
  const names = (path) => new Set(paths.filter(path).map(({ sport }) => sport));
  assert.deepEqual(names(({ sameSport }) => sameSport.some(({ source }) => source === "institution")),
    new Set(["필라테스", "헬스", "라인댄스"]));
  assert.deepEqual(names(({ sameSport }) => sameSport.length),
    new Set(["필라테스", "헬스", "라인댄스", "요가", "줌바댄스"]));
  assert.deepEqual(names(({ sameSport, sameField }) => !sameSport.length && sameField.length),
    new Set(["SNPE", "댄스로빅", "댄스스포츠", "라틴", "모던", "로드사이클"]));
  const gaps = names(({ sameSport, sameField }) => !sameSport.length && !sameField.length);
  assert.deepEqual(gaps, new Set(["배드민턴", "탁구", "테니스", "농구", "검도", "골프", "당구", "실내승마"]));
  assert.equal(confirmed.filter(({ id }) => gaps.has(courseDiscovery.get(id).sport)).length, 348);
});

test("raw sources, candidate eligibility, and both introduction signals remain distinct", () => {
  const external = onlineVideos.filter(({ source }) => source === "youtube");
  const titleIntro = ({ title }) => videoTitleIntroTerms(title).length > 0;
  assert.deepEqual([videos.length, external.length, onlineVideos.length], [56, 131, 187]);
  assert.equal(new Set(onlineVideos.map(({ id, source }) => `${source}:${id}`)).size, 187);
  const includedInstitutionIds = linkableVideos.filter(({ record }) => record.source === "institution").map(({ record }) => record.id);
  assert.equal(includedInstitutionIds.length, 40);
  const excludedInstitutionIds = [304, 291, 290, 256, 240, 235, 232, 319, 254, 228, 225, 221, 219, 246, 237, 222];
  assert.deepEqual(new Set(videos.filter(({ id }) => !includedInstitutionIds.includes(id)).map(({ id }) => id)), new Set(excludedInstitutionIds));
  assert.deepEqual(videos.filter(titleIntro).map(({ id }) => id), [304]);
  assert.equal(external.filter(titleIntro).length, 7);
  assert.equal(external.filter((video) => video.experience === "입문·기초").length, 44);
  assert.equal(external.filter((video) => titleIntro(video) && video.experience === "입문·기초").length, 2);
  assert.equal(external.filter((video) => video.experience === "판단 보류").length, 46);
  const beginnerZumba = searchDiscovery({ ...filters, field: "리듬·댄스", sport: "줌바댄스", experience: "처음 시작" });
  assert.equal(beginnerZumba.sameSport.length, 0);
  assert.equal(beginnerZumba.hasVideoPath, true);
});

test("search and roadmap share same-sport videos while P0 still controls offline recommendations", () => {
  const selected = { field: "리듬·댄스", sport: "줌바댄스", experience: "상관없음" };
  const discovery = searchDiscovery({ ...filters, ...selected });
  const roadmap = roadmapResults({ ...initialRoadmap, ...selected });
  assert.deepEqual(ids(roadmap.videos.filter(({ relationship }) => relationship === "sport").map(({ record }) => record)), ids(discovery.sameSport));
  const recommended = roadmapResults(initialRoadmap).courses.map(({ record }) => record);
  assert.ok(!recommended.some(({ id }) => [1662, 2007, 2019, 2031, 2040, 2043, 2046, 2049].includes(id)));
  const datedRecord = recommended.find((row) => getCourseStatus(row, "2026-11-27").endedInRecord);
  assert.ok(datedRecord);
  const status = getCourseStatus(datedRecord, "2026-11-27");
  assert.match(status.availability, /현재 운영·모집 미확인/);
  assert.ok(status.scheduleHoldReasons().includes("기록상 종료일 경과"));
});
