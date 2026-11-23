import test from "node:test";
import assert from "node:assert/strict";
import { courses, searchCourses } from "./search.ts";
import { getCourseDisplay } from "./course-display.ts";

const named = (title) => {
  const course = courses.find((course) => course.title === title);
  assert.ok(course, `Actual attached record: ${title}`);
  return course;
};

test("employee health course uses original long hours and an explicit employee tag", () => {
  const result = getCourseDisplay(named("26.임직원_헬스"));
  assert.equal(result.rawTitle, "26.임직원_헬스");
  assert.equal(result.displayTitle, "[월·화·수·목·금·토·일] 헬스 (06:00–21:50)");
  assert.deepEqual(result.displayTags, ["임직원"]);
});

test("body slim retains its program name and both original audience and registration condition", () => {
  const result = getCourseDisplay(named("바디슬림(화,목) 10:00~10:50 (헬스등록필수)"));
  assert.equal(result.displayTitle, "[화·목] 바디슬림 (10:00–10:50)");
  assert.deepEqual(result.displayTags, ["성인남여", "헬스등록필수"]);
});

test("adult and youth kendo remain distinct through source tags and original IDs", () => {
  const adult = named("검도 1930-2100 (월화목금) 성인");
  const youth = named("검도 0600-0730 (월화목금) 청소년");
  assert.equal(getCourseDisplay(adult).displayTitle, "[월·화·목·금] 검도 (19:30–21:00)");
  assert.deepEqual(getCourseDisplay(adult).displayTags, ["성인"]);
  assert.equal(getCourseDisplay(youth).displayTitle, "[월·화·목·금] 검도 (06:00–07:30)");
  assert.deepEqual(getCourseDisplay(youth).displayTags, ["청소년"]);
  assert.notEqual(adult.id, youth.id);
  assert.ok(!getCourseDisplay(adult).displayTitle.includes("토"));
});

test("unlabelled golf receives no empty or inferred tag", () => {
  const result = getCourseDisplay(named("골프12시 토"));
  assert.equal(result.displayTitle, "[토] 골프 (12:00–12:50)");
  assert.deepEqual(result.displayTags, []);
});

test("auxiliary information and conflicting times move out of the concise title, without losing source details", () => {
  const conflict = courses.find(
    (course) => course.title === "특강 6회 17~20시 김봉현" && course.rawTime === "17:00-21:00",
  );
  assert.ok(conflict);
  const result = getCourseDisplay(conflict);
  assert.equal(result.displayTitle, "[월·화·수·목·금] 골프 (17:00–21:00)");
  assert.ok(result.rawTitle.includes("6회 17~20시 김봉현"));
  assert.ok(result.timeConflicts.includes("17~20시"));
  assert.deepEqual(result.instructors, []);
  assert.equal(result.needsReview, true);
  const packageCourse = named("4.입문 패키지(입문3회+그룹8회)");
  assert.equal(
    getCourseDisplay(packageCourse).displayTitle,
    "[월·화·수·목·금·토·일] 로드사이클 (06:00–21:50)",
  );
  assert.deepEqual(getCourseDisplay(packageCourse).packageDetails, ["입문3회+그룹8회"]);
  const tennis = getCourseDisplay(named("황선홍 실외테니스(주말복수)"));
  assert.ok(tennis.displayTitle.includes("] 테니스 ("));
  assert.ok(tennis.additionalTypes.includes("주말복수"));
  assert.ok(!tennis.displayTitle.includes("황선홍"));
});

test("missing or malformed schedule information is not guessed", () => {
  const course = named("골프12시 토");
  const result = getCourseDisplay({ ...course, rawDays: "(토)", rawTime: "시간 미정" });
  assert.ok(result.displayTitle.startsWith("[요일 확인 필요]"));
  assert.ok(result.displayTitle.endsWith("(시간 확인 필요)"));
  assert.equal(result.rawTitle, course.title);
  assert.equal(result.needsReview, true);
});

test("level tags are source wording only, not recommendations", () => {
  const result = getCourseDisplay(named("당구 초급 19-21 월~금"));
  assert.equal(result.displayTitle, "[월·화·수·목·금] 당구 (19:00–21:00)");
  assert.deepEqual(result.displayTags, ["초급"]);
});

test("all derivations leave raw course records, IDs, and search results unchanged", () => {
  const snapshot = JSON.stringify(courses);
  const filters = {
    mode: "offline",
    sport: "성인",
    days: [],
    start: "06",
    end: "22",
    budget: 100000,
  };
  const before = searchCourses(filters).map((course) => course.id);
  for (const course of courses) {
    const result = getCourseDisplay(course);
    assert.equal(result.rawTitle, course.title);
    assert.ok(
      result.displayTags.every((tag) => course.title.includes(tag) || course.audience === tag),
    );
    assert.equal(new Set(result.displayTags).size, result.displayTags.length);
    assert.ok(result.displayTitle.startsWith("["));
  }
  assert.equal(JSON.stringify(courses), snapshot);
  assert.deepEqual(
    searchCourses(filters).map((course) => course.id),
    before,
  );
});

test("conflicting spaced ranges remain available in details while the title follows the time field", () => {
  const source = named("골프12시 토");
  const course = { ...source, title: "골프 12:00 - 18:00 (토)", rawTime: "12:00-12:50" };
  const result = getCourseDisplay(course);
  assert.equal(result.displayTitle, "[토] 골프 (12:00–12:50)");
  assert.deepEqual(result.timeConflicts, ["12:00 - 18:00"]);
  assert.equal(result.rawTitle, course.title);
  assert.equal(result.needsReview, true);
});

test("a standalone title time that conflicts with the CSV field is retained in details for review", () => {
  const source = named("골프12시 토");
  const result = getCourseDisplay({ ...source, title: "골프 13시 토" });
  assert.equal(result.displayTitle, "[토] 골프 (12:00–12:50)");
  assert.deepEqual(result.timeConflicts, ["13시"]);
  assert.equal(result.needsReview, true);
});
