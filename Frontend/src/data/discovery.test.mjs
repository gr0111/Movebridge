import test from "node:test";
import assert from "node:assert/strict";
import {
  courses,
  videos,
  onlineVideos,
  searchCourses,
  searchVideos,
  sampleCharts,
  searchableCourses,
} from "./search.ts";
import { rawCourses, rawVideos } from "./sample-data.ts";
import {
  analyzeBeginnerTitle,
  classifyCourse,
  classifyVideo,
  searchDiscovery,
  groupByBeginner,
  discoveryDistribution,
  beginnerTotals,
  beginnerChart,
  courseDiscovery,
  videoDiscovery,
} from "./discovery.ts";

const all = {
  mode: "all",
  sport: "전체 종목",
  days: [],
  start: "06",
  end: "22",
  budget: Infinity,
  field: "전체 분야",
  experience: "상관없음",
};

test("broad fields use actual sport words, not registration requirements or inferred program meanings", () => {
  for (const [sport, field] of [
    ["요가", "유연성·스트레칭"],
    ["필라테스", "유연성·스트레칭"],
    ["SNPE", "유연성·스트레칭"],
    ["헬스", "근력·체력 향상"],
    ["라인댄스", "리듬·댄스"],
    ["댄스스포츠", "리듬·댄스"],
    ["검도", "기타 운동"],
    ["로드사이클", "유산소·러닝·사이클"],
  ]) {
    const actual = courses.find((course) => course.sport === sport);
    assert.ok(actual);
    assert.equal(classifyCourse(actual).field, field);
  }
  const bodySlim = courses.find((course) => course.title.includes("헬스등록필수"));
  assert.ok(bodySlim);
  assert.equal(classifyCourse(bodySlim).field, "분류 확인 필요");
  assert.equal(
    classifyCourse({ title: "내용 확인 필요", sport: "미기재" }).field,
    "분류 확인 필요",
  );
});

test("video metadata classification is respected even when its title mentions a different sport", () => {
  const golf = videos.find((video) => video.title === "골프 비거리 향상을 위한 근력운동");
  assert.ok(golf);
  assert.equal(classifyVideo(golf).field, "근력·체력 향상");
  const unknown = videos.find((video) => video.title.includes("Beginner"));
  assert.equal(classifyVideo(unknown).field, "분류 확인 필요");
  const application = videos.find((video) => video.title === "올림픽수영장 온라인 수강신청 방법");
  assert.equal(classifyVideo(application).field, "운동 외 콘텐츠");
});

test("only explicit introduction wording qualifies, not physiological basics or mixed/partial English words", () => {
  for (const title of ["입문 패키지", "당구 초급", "탁구 기초", "Easy Beginner", "beginner"])
    assert.equal(analyzeBeginnerTitle(title).hasBeginnerKeyword, true);
  for (const title of [
    "기초체력",
    "기초 체력 향상",
    "기초대사량",
    "초.중급",
    "초급/중급",
    "Beginnering",
    "라인댄스",
  ])
    assert.equal(analyzeBeginnerTitle(title).hasBeginnerKeyword, false, title);
  assert.deepEqual(analyzeBeginnerTitle("입문 입문 초급").beginnerMatchedTerms, ["입문", "초급"]);
});

test("A: flexibility first-time search shows real related records even with no introduction expressions", () => {
  const result = searchDiscovery({ ...all, field: "유연성·스트레칭", experience: "처음 시작" });
  assert.ok(result.online.length > 0 && result.offline.length > 0);
  assert.ok(
    result.online.every((video) => videoDiscovery.get(video.id).field === "유연성·스트레칭"),
  );
  assert.ok(
    result.offline.every((course) => courseDiscovery.get(course.id).field === "유연성·스트레칭"),
  );
  assert.equal(groupByBeginner(result.online.filter((video) => video.source === "institution")).first.length, 0);
  assert.equal(groupByBeginner(result.offline).first.length, 0);
  assert.equal(groupByBeginner(result.offline).other.length, result.offline.length);
});

test("B: any or experienced selections do not trigger introduction prioritization", () => {
  const any = searchDiscovery({ ...all, field: "근력·체력 향상" });
  assert.ok(any.offline.length > 0 && any.online.length > 0);
  assert.equal(any.prioritize, false);
  const experienced = searchDiscovery({ ...all, experience: "운동 경험 있음" });
  assert.deepEqual(
    experienced.offline,
    searchCourses(all).sort((a, b) => a.id - b.id),
  );
  assert.deepEqual(experienced.online, searchVideos("전체 종목").filter(
    (video) => video.source === "institution" || ["중급", "고급"].includes(video.experience),
  ));
});

test("C: original sport/day/time/budget semantics are unchanged with default new fields", () => {
  const filters = { ...all, sport: "검도", days: [0, 1], start: "18", end: "20", budget: 70000 };
  assert.deepEqual(searchDiscovery(filters).offline, searchCourses(filters));
  assert.equal(searchDiscovery(filters).offline.length, 1);
  assert.deepEqual(searchDiscovery({ ...filters, days: [5] }).offline, []);
});

test("default first-time ordering prioritizes wording without dropping other matching records", () => {
  const result = searchDiscovery({ ...all, experience: "처음 시작" });
  const groups = groupByBeginner(result.offline);
  assert.ok(groups.first.length > 0 && groups.other.length > 0);
  assert.deepEqual(result.offline.slice(0, groups.first.length), groups.first);
  assert.equal(result.offline.length, searchableCourses.length);
  assert.equal(result.online.filter((video) => video.source === "institution").length, videos.length);
  assert.ok(analyzeBeginnerTitle(result.online[0].title).hasBeginnerKeyword);
  assert.equal(new Set(result.offline.map((course) => course.id)).size, searchableCourses.length);
});

test("explicit price and time sorts override first-time priority; videos retain source order", () => {
  for (const sort of ["price", "time"]) {
    const result = searchDiscovery({ ...all, experience: "처음 시작" }, sort);
    assert.equal(result.prioritize, false);
    const value = (course) => (sort === "price" ? course.price : course.start);
    assert.ok(
      result.offline.every(
        (course, index) => !index || value(result.offline[index - 1]) <= value(course),
      ),
    );
    assert.deepEqual(result.online, onlineVideos.filter(
      (video) => video.source === "institution" || video.experience === "입문·기초",
    ));
  }
});

test("offline conditions never constrain videos, and modes are independent", () => {
  assert.deepEqual(
    searchDiscovery({ ...all, days: [6], start: "21", end: "22", budget: 0 }).online,
    onlineVideos,
  );
  assert.equal(searchDiscovery({ ...all, mode: "online" }).offline.length, 0);
  assert.equal(searchDiscovery({ ...all, mode: "offline" }).online.length, 0);
  const filtered = searchDiscovery({ ...all, field: "유연성·스트레칭", sport: "필라테스" });
  assert.ok(filtered.online.every((video) => video.title.includes("필라테스") || video.discipline?.includes("필라테스")));
  assert.ok(filtered.offline.every((course) => course.sport === "필라테스"));
});

test("D: missing records and absent beginner wording produce empty groups, never generated recommendations", () => {
  const none = searchDiscovery({ ...all, sport: "존재하지않는강좌", experience: "처음 시작" });
  assert.deepEqual(none.offline, []);
  assert.deepEqual(none.online, []);
  assert.deepEqual(none.related, []);
  const swim = searchDiscovery({ ...all, field: "수영·수중운동", experience: "처음 시작" });
  assert.ok(groupByBeginner(swim.online).other.length > 0);
  assert.equal(groupByBeginner(swim.online).first.length, 0);
});

test("related-field videos never duplicate direct results or escape the selected field", () => {
  const result = searchDiscovery({ ...all, field: "유연성·스트레칭", sport: "요가" });
  assert.ok(result.related.length > 0);
  assert.ok(
    result.related.every(
      (video) =>
        videoDiscovery.get(video.id).field === "유연성·스트레칭" &&
        !result.online.some((direct) => direct.id === video.id),
    ),
  );
  assert.equal(
    searchDiscovery({ ...all, field: "근력·체력 향상", sport: "요가" }).related.length,
    0,
  );
});

test("all field distributions and keyword totals are derived from the complete current samples", () => {
  assert.equal(
    discoveryDistribution.reduce((sum, row) => sum + row.offline, 0),
    400,
  );
  assert.equal(
    discoveryDistribution.reduce((sum, row) => sum + row.online, 0),
    56,
  );
  assert.equal(
    beginnerTotals.offline,
    rawCourses.filter((row) => analyzeBeginnerTitle(row.강좌명).hasBeginnerKeyword).length,
  );
  assert.equal(
    beginnerTotals.online,
    rawVideos.filter((row) => analyzeBeginnerTitle(row.제목).hasBeginnerKeyword).length,
  );
  assert.equal(beginnerChart.values[0] + beginnerChart.values[1], 400);
  assert.equal(beginnerChart.values[2] + beginnerChart.values[3], 56);
  for (const index of [0, 1, 3])
    assert.equal(
      sampleCharts[index].values.reduce((sum, value) => sum + value, 0),
      400,
    );
});

test("classification and prioritization do not mutate original data or display/source fields", () => {
  const before = JSON.stringify({ rawCourses, rawVideos, courses, videos });
  for (const experience of ["상관없음", "처음 시작", "운동 경험 있음"])
    for (const sort of ["default", "price", "time"]) searchDiscovery({ ...all, experience }, sort);
  assert.equal(JSON.stringify({ rawCourses, rawVideos, courses, videos }), before);
});
