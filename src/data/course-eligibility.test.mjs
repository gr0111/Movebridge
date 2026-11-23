import test from "node:test";
import assert from "node:assert/strict";
import { assessCourseEligibility } from "./course-eligibility.ts";
import {
  courses,
  videos,
  searchableCourses,
  excludedCourses,
  courseEligibility,
  courseExclusionSummary,
  searchCourses,
  sampleCharts,
} from "./search.ts";
import { searchDiscovery, getDetailOptions, discoveryDistribution } from "./discovery.ts";
import { COURSE_PAGE_SIZE, visibleCourseRecords } from "./course-pagination.ts";

const all = {
  mode: "all",
  field: "전체 분야",
  experience: "상관없음",
  sport: "전체 종목",
  days: [],
  start: "06",
  end: "22",
  budget: Infinity,
};

test("one unresolvable free-use row is excluded but all 400 original rows and 56 videos remain intact", () => {
  assert.equal(courses.length, 400);
  assert.equal(videos.length, 56);
  assert.equal(searchableCourses.length, 399);
  assert.equal(excludedCourses.length, 1);
  assert.equal(excludedCourses[0].title, "자유이용");
  assert.equal(excludedCourses[0].sport, "미기재");
  assert.equal(courseEligibility.get(excludedCourses[0].id).searchableAsCourse, false);
  assert.equal(courseEligibility.get(excludedCourses[0].id).resolvedSport, null);
  assert.ok(courseExclusionSummary[0].reason.includes("확인할 수 없음"));
  assert.equal(
    courseExclusionSummary.reduce((sum, item) => sum + item.count, 0),
    excludedCourses.length,
  );
  assert.equal(searchCourses(all).length, 399);
  assert.equal(searchDiscovery(all).offline.length, 399);
  assert.equal(searchDiscovery(all).online.filter((video) => video.source === "institution").length, 56);
  assert.deepEqual(searchDiscovery({ ...all, sport: "자유이용" }).offline, []);
});

test("confirmed sports in titles are retained when the original sport is absent", () => {
  for (const title of ["필라테스 10시", "수영 자유이용", "탁구 이용권"]) {
    const result = assessCourseEligibility({ sport: "", title });
    assert.equal(result.searchableAsCourse, true);
    assert.equal(result.sportResolutionStatus, "title");
    assert.ok(result.resolvedSport);
  }
  for (const title of ["자유이용", "시설이용", "이용권", "헬스등록필수 이용권"]) {
    assert.equal(assessCourseEligibility({ sport: "미기재", title }).searchableAsCourse, false);
  }
});

test("access wording alone never excludes a record with a confirmed sport, and holiday programs are kept", () => {
  const cycling = courses.find(
    (course) => course.sport === "로드사이클" && course.title === "자율이용",
  );
  assert.ok(cycling);
  assert.equal(courseEligibility.get(cycling.id).searchableAsCourse, true);
  assert.equal(
    assessCourseEligibility({ sport: "테니스", title: "시설이용" }).searchableAsCourse,
    true,
  );
  const holiday = courses.filter((course) => course.sport === "방학특강");
  assert.ok(holiday.length);
  assert.ok(holiday.every((course) => courseEligibility.get(course.id).searchableAsCourse));
  assert.equal(
    courseEligibility.get(holiday.find((course) => course.title.includes("실내승마")).id)
      .resolvedSport,
    "실내승마",
  );
  assert.equal(
    courseEligibility.get(holiday.find((course) => course.title.includes("탁구")).id).resolvedSport,
    "탁구",
  );
  assert.ok(
    holiday
      .filter((course) => course.title.includes("배민"))
      .every((course) => courseEligibility.get(course.id).sportResolutionStatus === "inferred"),
  );
});

test("raw analysis totals remain 400, while normal search totals and detail choices use the eligible subset", () => {
  for (const index of [0, 1, 3])
    assert.equal(
      sampleCharts[index].values.reduce((sum, value) => sum + value, 0),
      400,
    );
  assert.equal(
    discoveryDistribution.reduce((sum, row) => sum + row.offline, 0),
    400,
  );
  assert.ok(!getDetailOptions(all).sports.includes("미기재"));
  assert.ok(
    !searchDiscovery(all).offline.some((course) =>
      excludedCourses.some((excluded) => excluded.id === course.id),
    ),
  );
  for (const row of searchableCourses) assert.ok(courses.includes(row));
});

test("nine-item prefixes work for normal and beginner-sorted lists, with no duplication or omissions", () => {
  assert.equal(COURSE_PAGE_SIZE, 9);
  for (const experience of ["상관없음", "처음 시작"]) {
    const records = searchDiscovery({ ...all, experience }).offline;
    const first = visibleCourseRecords(records, 9);
    const second = visibleCourseRecords(records, 18);
    assert.equal(first.length, 9);
    assert.equal(second.length, 18);
    assert.deepEqual(second.slice(0, 9), first);
    assert.equal(new Set(second.map((record) => record.id)).size, 18);
    assert.deepEqual(visibleCourseRecords(records, 999), records);
  }
});
