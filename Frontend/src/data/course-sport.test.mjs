import test from "node:test";
import assert from "node:assert/strict";
import { courses, videos, sampleCharts } from "./search.ts";
import { resolveCourseSport, sportIconKeys } from "./course-sport.ts";
import { getCourseDisplay } from "./course-display.ts";
import { searchDiscovery } from "./discovery.ts";
import { discoveryDistribution } from "./public-data-analysis.ts";

const actual = (title) => {
  const course = courses.find((course) => course.title === title);
  assert.ok(course, title);
  return course;
};

test("every requested sport has a distinct dedicated pictogram identity", () => {
  const sports = [
    "당구",
    "댄스로빅",
    "라틴",
    "모던",
    "라인댄스",
    "실내승마",
    "배드민턴",
    "탁구",
    "테니스",
    "필라테스",
    "농구",
    "골프",
    "검도",
    "헬스",
    "요가",
    "SNPE",
    "바디슬림",
    "바디 트레이닝",
    "로드사이클",
    "줌바댄스",
    "댄스스포츠",
  ];
  const keys = sports.map((sport) => resolveCourseSport({ sport, title: "" }).pictogramKey);
  assert.equal(new Set(keys).size, sports.length);
  assert.ok(keys.every((key) => key !== "activity" && sportIconKeys.includes(key)));
});

test("modern and Latin subtypes are based on explicit original title prefixes", () => {
  const modern = getCourseDisplay(actual("모던 1600-1730(금) *김진아 강사"));
  assert.equal(modern.displayTitle, "[금] 모던 (16:00–17:30)");
  assert.equal(modern.pictogramKey, "ballroom");
  assert.deepEqual(modern.instructors, ["김진아"]);
  const latin = getCourseDisplay(actual("라틴12:00-13:30(금) *최수정 강사"));
  assert.equal(latin.displayTitle, "[금] 라틴 (12:00–13:30)");
  assert.equal(latin.pictogramKey, "latin");
  assert.deepEqual(latin.instructors, ["최수정"]);
});

test("base sports replace special program/instructor wording while original values remain intact", () => {
  const child = getCourseDisplay(actual("어린이 특별 강습 (월수금) 17시"));
  assert.equal(child.displayTitle, "[월·수·금] 배드민턴 (17:00–18:00)");
  assert.ok(child.additionalTypes.includes("어린이 특별 강습"));
  assert.ok(child.displayTags.includes("어린이"));
  const billiards = getCourseDisplay(actual("국제식 3쿠션 19-21 월~금"));
  assert.equal(billiards.displayTitle, "[월·화·수·목·금] 당구 (19:00–21:00)");
  assert.ok(billiards.additionalTypes.includes("국제식 3쿠션"));
  const pack = getCourseDisplay(actual("5.그룹 패키지(개인4회+그룹8회)"));
  assert.equal(pack.displayTitle, "[월·화·수·목·금·토·일] 로드사이클 (06:00–21:50)");
  assert.ok(pack.additionalTypes.includes("그룹 패키지"));
  assert.deepEqual(pack.packageDetails, ["개인4회+그룹8회"]);
});

test("exact sport aliases and explicit holiday sports get the right icon without reclassifying discovery", () => {
  const holiday = getCourseDisplay(actual("26. 방특 실내승마 화목14시"));
  assert.equal(holiday.displayTitle, "[화·목] 실내승마 (14:00–14:50)");
  assert.equal(holiday.pictogramKey, "horse");
  assert.ok(holiday.additionalTypes.includes("방학특강"));
  assert.equal(resolveCourseSport({ sport: "탁구단기속성", title: "" }).displaySport, "탁구");
  assert.equal(
    resolveCourseSport({ sport: "배드민턴 단기속성", title: "" }).pictogramKey,
    "badminton",
  );
  assert.equal(resolveCourseSport({ sport: "실내승마교실", title: "" }).displaySport, "실내승마");
});

test("only the approved holiday abbreviation is inferred; other missing sports and bare names remain untouched", () => {
  const holiday = getCourseDisplay(actual("26. 방특 배민 월수금 13시"));
  assert.equal(holiday.displaySport, "배드민턴");
  assert.equal(holiday.pictogramKey, "badminton");
  assert.equal(holiday.sportResolutionStatus, "inferred");
  assert.equal(holiday.needsReview, true);
  assert.equal(
    resolveCourseSport({ sport: "미기재", title: "자유이용" }).displaySport,
    "종목 미기재",
  );
  assert.equal(
    resolveCourseSport({ sport: "방학특강", title: "26. 방특 종목 미확인 13시" })
      .sportResolutionStatus,
    "unresolved",
  );
  assert.equal(
    resolveCourseSport({ sport: "새로운 종목", title: "안내" }).displaySport,
    "새로운 종목",
  );
  assert.deepEqual(getCourseDisplay(actual("특강 (토) 12회 12~18 김봉현")).instructors, []);
  const paused = getCourseDisplay(actual("실내승마교실 17:00 화목 - 일시중지"));
  assert.ok(paused.additionalTypes.some((value) => value.includes("현재 상태는 미확인")));
  assert.ok(!paused.displayTitle.includes("일시중지"));
});

test("all 400 display titles follow one structure with original schedule, tags and identities preserved", () => {
  const snapshot = JSON.stringify({ courses, videos, sampleCharts, discoveryDistribution });
  const filters = {
    mode: "all",
    field: "전체 분야",
    experience: "처음 시작",
    sport: "전체 종목",
    days: [],
    start: "06",
    end: "22",
    budget: Infinity,
  };
  const before = searchDiscovery(filters);
  for (const course of courses) {
    const display = getCourseDisplay(course);
    assert.equal(display.rawTitle, course.title);
    assert.ok(display.displayTitle.includes(`] ${display.displaySport} (`));
    assert.ok(display.displayTitle.endsWith(`(${course.rawTime.replace("-", "–")})`));
    assert.ok(!display.displayTitle.includes("*"));
    assert.ok(!display.displayTitle.includes("주말복수"));
    assert.ok(!display.displayTitle.includes("패키지"));
    assert.ok(!display.displayTitle.includes("헬스등록필수"));
    assert.ok(
      display.displayTags.every((tag) => course.title.includes(tag) || course.audience === tag),
    );
    if (course.parentheticalDays) assert.ok(!display.displayTitle.split("]")[0].includes("("));
  }
  assert.deepEqual(searchDiscovery(filters), before);
  assert.equal(JSON.stringify({ courses, videos, sampleCharts, discoveryDistribution }), snapshot);
});
