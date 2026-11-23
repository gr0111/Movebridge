import test from "node:test";
import assert from "node:assert/strict";
import { courses, videos, onlineVideos, sampleCharts } from "./search.ts";
import { rawCourses, rawVideos } from "./sample-data.ts";
import {
  getDetailOptions,
  isDetailSelectionValid,
  updateDiscoveryFilter,
  interestFields,
  experienceOptions,
  searchDiscovery,
  classifyCourse,
  discoveryDistribution,
  beginnerTotals,
} from "./discovery.ts";

const externalDisciplines = (field) =>
  onlineVideos.flatMap((video) =>
    video.source === "youtube" && video.sport === field ? [video.discipline] : [],
  );

const base = {
  mode: "all",
  field: "전체 분야",
  sport: "전체 종목",
  experience: "상관없음",
  days: [],
  start: "06",
  end: "22",
  budget: Infinity,
};

test("A: flexibility options are actual yoga/Pilates/SNPE sports and classified videos only", () => {
  const options = getDetailOptions({ ...base, field: "유연성·스트레칭" });
  assert.deepEqual(options.sports, [...new Set(["요가", "필라테스", "SNPE", ...externalDisciplines("유연성·스트레칭")])]);
  assert.ok(!options.sports.some((sport) => ["헬스", "골프", "검도"].includes(sport)));
  assert.deepEqual(options.videoTitles, [
    ...new Set(
      onlineVideos.filter((video) => video.sport === "유연성·스트레칭").map((video) => video.title),
    ),
  ]);
  assert.ok(
    courses
      .filter((course) => course.title.includes("필라테스"))
      .every((course) => classifyCourse(course).field === "유연성·스트레칭"),
  );
  assert.ok(options.videoTitles.includes("기구필라테스"));
});

test("B: strength sports include actual health/TRX, not Pilates or golf from a strength video title", () => {
  const options = getDetailOptions({ ...base, field: "근력·체력 향상" });
  assert.deepEqual(options.sports, [...new Set(["헬스", "TRX", ...externalDisciplines("근력·체력 향상")])]);
  assert.ok(!options.sports.includes("필라테스"));
  assert.ok(!options.sports.includes("골프"));
  assert.ok(options.videoTitles.includes("골프 비거리 향상을 위한 근력운동"));
  assert.ok(!options.videoTitles.includes("필라테스"));
});

test("C: a field change clears incompatible selections and the next search contains no stale query", () => {
  const selected = { ...base, field: "유연성·스트레칭", sport: "필라테스" };
  const next = updateDiscoveryFilter(selected, "field", "근력·체력 향상");
  assert.equal(next.sport, "전체 종목");
  const result = searchDiscovery(next);
  assert.ok(result.offline.length > 0 && result.online.length > 0);
  assert.ok(!result.offline.some((course) => course.sport === "필라테스"));
  assert.equal(selected.sport, "필라테스");
  assert.equal(updateDiscoveryFilter(selected, "field", "전체 분야").sport, "필라테스");
});

test("D: all fields/offline includes every real nonempty source sport, without adding category labels", () => {
  const options = getDetailOptions({ ...base, mode: "offline" });
  assert.deepEqual(options.sports, [...new Set(rawCourses.map((row) => row.종목).filter(Boolean))]);
  assert.deepEqual(options.videoTitles, []);
  assert.ok(!options.sports.includes("미기재"));
  assert.ok(!options.sports.includes("유연성·스트레칭"));
  assert.equal(
    getDetailOptions(base).videoTitles.length,
    new Set(onlineVideos.map((video) => video.title)).size,
  );
});

test("E: experience and offline availability do not remove options or disable beginner priority", () => {
  const expected = getDetailOptions({ ...base, field: "리듬·댄스" });
  for (const experience of experienceOptions) {
    const filters = {
      ...base,
      field: "리듬·댄스",
      experience,
      budget: 0,
      days: [6],
      start: "21",
      end: "22",
    };
    assert.deepEqual(getDetailOptions(filters), expected);
  }
  assert.equal(searchDiscovery({ ...base, experience: "처음 시작" }).prioritize, true);
  const selected = { ...base, field: "유연성·스트레칭", sport: "필라테스" };
  assert.equal(updateDiscoveryFilter(selected, "experience", "처음 시작").sport, "필라테스");
});

test("F: modes filter both option groups and reset only incompatible selections", () => {
  const strength = { ...base, field: "근력·체력 향상" };
  assert.deepEqual(getDetailOptions({ ...strength, mode: "offline" }).sports, ["헬스"]);
  assert.deepEqual(getDetailOptions({ ...strength, mode: "offline" }).videoTitles, []);
  assert.deepEqual(getDetailOptions({ ...strength, mode: "online" }).sports, [...new Set(["헬스", "TRX", ...externalDisciplines("근력·체력 향상")])]);
  assert.equal(
    updateDiscoveryFilter({ ...strength, mode: "online", sport: "TRX" }, "mode", "offline").sport,
    "전체 종목",
  );
  const flexibility = { ...base, field: "유연성·스트레칭", mode: "online", sport: "기구필라테스" };
  assert.equal(updateDiscoveryFilter(flexibility, "mode", "offline").sport, "전체 종목");
  assert.equal(
    updateDiscoveryFilter({ ...flexibility, sport: "필라테스" }, "mode", "offline").sport,
    "필라테스",
  );
  assert.equal(
    updateDiscoveryFilter({ ...base, sport: "검도" }, "mode", "online").sport,
    "전체 종목",
  );
});

test("each displayed option produces actual direct results in the same field and mode", () => {
  for (const field of ["전체 분야", ...interestFields])
    for (const mode of ["all", "offline", "online"]) {
      const context = { ...base, field, mode };
      const options = getDetailOptions(context);
      assert.equal(new Set(options.sports).size, options.sports.length);
      assert.equal(new Set(options.videoTitles).size, options.videoTitles.length);
      for (const sport of options.sports) {
        assert.equal(isDetailSelectionValid(sport, context), true);
        const results = searchDiscovery({ ...context, sport });
        assert.ok(results.offline.length + results.online.length > 0, `${field}/${mode}/${sport}`);
      }
      for (const title of options.videoTitles) {
        assert.ok(onlineVideos.some((video) => video.title === title));
        assert.ok(
          searchDiscovery({ ...context, sport: title }).online.some(
            (video) => video.title === title,
          ),
        );
      }
    }
});

test("missing mode/field data yields no invented detail choices", () => {
  assert.deepEqual(getDetailOptions({ ...base, mode: "offline", field: "수영·수중운동" }), {
    sports: [],
    videoTitles: [],
  });
  assert.deepEqual(getDetailOptions({ ...base, mode: "online", field: "기타 운동" }), {
    sports: [],
    videoTitles: [],
  });
});

test("free-text queries remain supported if they still match real source records", () => {
  assert.equal(
    updateDiscoveryFilter({ ...base, sport: "비거리" }, "field", "근력·체력 향상").sport,
    "비거리",
  );
  assert.equal(
    updateDiscoveryFilter({ ...base, sport: "비거리" }, "field", "유연성·스트레칭").sport,
    "전체 종목",
  );
  assert.equal(
    isDetailSelectionValid("전체 종목", { ...base, mode: "offline", field: "수영·수중운동" }),
    true,
  );
});

test("option generation and reconciliation preserve original records, counts, charts and keyword totals", () => {
  const before = JSON.stringify({
    rawCourses,
    rawVideos,
    courses,
    videos,
    sampleCharts,
    discoveryDistribution,
    beginnerTotals,
  });
  for (const field of ["전체 분야", ...interestFields])
    for (const mode of ["all", "offline", "online"]) {
      getDetailOptions({ field, mode });
      updateDiscoveryFilter({ ...base, sport: "필라테스" }, "field", field);
    }
  assert.equal(
    JSON.stringify({
      rawCourses,
      rawVideos,
      courses,
      videos,
      sampleCharts,
      discoveryDistribution,
      beginnerTotals,
    }),
    before,
  );
  assert.equal(courses.length, 400);
  assert.equal(videos.length, 56);
});
