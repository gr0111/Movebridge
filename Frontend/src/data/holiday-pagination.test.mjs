import test from "node:test";
import assert from "node:assert/strict";
import {
  courses,
  videos,
  searchableCourses,
  excludedCourses,
  searchCourses,
  sampleCharts,
} from "./search.ts";
import { resolveCourseSport, inferHolidaySport } from "./course-sport.ts";
import { getCourseDisplay } from "./course-display.ts";
import {
  classifyCourse,
  searchDiscovery,
  getDetailOptions,
} from "./discovery.ts";
import { analyzedCourses, discoveryDistribution } from "./public-data-analysis.ts";
import {
  COURSE_PAGE_SIZE,
  COURSE_LOAD_MORE_SIZE,
  visibleCourseRecords,
} from "./course-pagination.ts";

const all = {
  field: "전체 분야",
  experience: "상관없음",
  mode: "all",
  sport: "전체 종목",
  days: [],
  start: "06",
  end: "22",
  budget: Infinity,
};
const holidayBadminton = courses.filter(
  (course) => course.sport === "방학특강" && course.title.includes("방특 배민"),
);

test("only two source-evidenced holiday records use a clearly marked badminton inference", () => {
  assert.equal(holidayBadminton.length, 2);
  for (const course of holidayBadminton) {
    const display = getCourseDisplay(course);
    assert.equal(display.displaySport, "배드민턴");
    assert.equal(display.pictogramKey, "badminton");
    assert.equal(display.sportResolutionStatus, "inferred");
    assert.ok(display.sportResolutionEvidence.includes("공식 약어 해석은 확인되지"));
    assert.ok(display.additionalTypes.includes("방학특강"));
    assert.ok(display.displayTags.includes("청소년"));
    assert.equal(display.displayTitle, `[월·수·금] 배드민턴 (${course.rawTime.replace("-", "–")})`);
    assert.equal(display.rawTitle, course.title);
    assert.equal(course.sport, "방학특강");
  }
  assert.ok(holidayBadminton.some((course) => course.title === "26. 방특 배민 월수금 13시"));
});

test("other holiday types and unrelated abbreviation contexts never become badminton", () => {
  const other = courses.filter(
    (course) => course.sport === "방학특강" && !course.title.includes("방특 배민"),
  );
  assert.ok(other.some((course) => resolveCourseSport(course).displaySport === "실내승마"));
  assert.ok(other.some((course) => resolveCourseSport(course).displaySport === "탁구"));
  assert.ok(other.every((course) => !inferHolidaySport(course)));
  assert.equal(inferHolidaySport({ sport: "골프", title: "방특 배민 13시" }), null);
  assert.equal(inferHolidaySport({ sport: "방학특강", title: "배민 안내 13시" }), null);
  assert.equal(inferHolidaySport({ sport: "방학특강", title: "방특 배민 실내승마 13시" }), null);
  assert.equal(
    resolveCourseSport({ sport: "방학특강", title: "방특 확인 필요" }).sportResolutionStatus,
    "unresolved",
  );
  assert.equal(
    resolveCourseSport({ sport: "방학특강", title: "방특 확인 필요" }).displaySport,
    "종목 확인 필요",
  );
});

test("badminton search, field selection, and option validation all include both inferred records", () => {
  const query = { ...all, field: "기타 운동", sport: "배드민턴" };
  const matches = searchDiscovery(query).offline;
  for (const course of holidayBadminton) {
    assert.equal(classifyCourse(course).field, "라켓 스포츠");
    assert.ok(searchCourses(query).some((match) => match.id === course.id));
    assert.ok(matches.some((match) => match.id === course.id));
  }
  assert.ok(getDetailOptions(query).sports.includes("배드민턴"));
  assert.ok(
    !searchDiscovery({ ...query, field: "유연성·스트레칭" }).offline.some((match) =>
      holidayBadminton.some((course) => course.id === match.id),
    ),
  );
});

test("initial nine and cumulative +21 prefixes preserve ordering for normal, manual and beginner sorts", () => {
  assert.equal(COURSE_PAGE_SIZE, 9);
  assert.equal(COURSE_LOAD_MORE_SIZE, 21);
  for (const experience of ["상관없음", "처음 시작"])
    for (const sort of ["default", "price", "time"]) {
      const records = searchDiscovery({ ...all, experience }, sort).offline;
      let previous = [];
      for (const [clicks, expected] of [
        [0, 9],
        [1, 30],
        [2, 51],
        [3, 72],
      ]) {
        const shown = visibleCourseRecords(
          records,
          COURSE_PAGE_SIZE + clicks * COURSE_LOAD_MORE_SIZE,
        );
        assert.equal(shown.length, expected);
        assert.deepEqual(shown.slice(0, previous.length), previous);
        assert.equal(new Set(shown.map((record) => record.id)).size, expected);
        previous = shown;
      }
      assert.equal(visibleCourseRecords(records, 387).length, 387);
      assert.deepEqual(visibleCourseRecords(records, 408), records);
    }
  const short = searchDiscovery({ ...all, sport: "검도" }).offline;
  assert.deepEqual(visibleCourseRecords(short, 30), short);
});

test("all source counts and original-wording analysis stay intact; unresolved sport and inferred status differ", () => {
  assert.equal(courses.length, 400);
  assert.equal(videos.length, 56);
  assert.equal(searchableCourses.length, 399);
  assert.equal(excludedCourses.length, 1);
  assert.equal(excludedCourses[0].title, "자유이용");
  assert.equal(
    courses.filter((course) => resolveCourseSport(course).sportResolutionStatus === "unresolved")
      .length,
    1,
  );
  assert.equal(
    searchableCourses.filter(
      (course) => resolveCourseSport(course).sportResolutionStatus === "unresolved",
    ).length,
    0,
  );
  assert.equal(
    courses.filter((course) => resolveCourseSport(course).sportResolutionStatus === "inferred")
      .length,
    2,
  );
  for (const row of discoveryDistribution)
    assert.equal(
      row.offline,
      courses.filter((course) => analyzedCourses.get(course.id).field === row.field).length,
    );
  assert.equal(discoveryDistribution.find((row) => row.field === "라켓 스포츠").offline, 171);
  for (const index of [0, 1, 3])
    assert.equal(
      sampleCharts[index].values.reduce((sum, value) => sum + value, 0),
      400,
    );
});
