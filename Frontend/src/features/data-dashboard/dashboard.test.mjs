import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { courses, searchableCourses, videos, onlineVideos } from "../../data/search.ts";
import {
  auditFieldOptions,
  auditSportOptions,
  emptyFilters,
  filterAudit,
  percent,
  unknownSport,
  yearlySports,
} from "./model.ts";

const load = (filename) =>
  JSON.parse(readFileSync(new URL(`./generated/${filename}.json`, import.meta.url), "utf8"));
const rows = load("course-records");
const summary = load("overview");
const count = (filters) => filterAudit(rows, { ...emptyFilters, ...filters }).matches.length;

test("the full, service, historical and search scopes preserve counts and service IDs", () => {
  assert.deepEqual(
    [
      count({}),
      count({ scope: "2026" }),
      count({ scope: "before_2026" }),
      count({ scope: "search" }),
    ],
    [2137, 400, 1737, 399],
  );
  assert.equal(new Set(rows.map(([id]) => id)).size, 2137);
  const ids = (scope) =>
    filterAudit(rows, { ...emptyFilters, scope })
      .matches.map(([id]) => id)
      .sort();
  assert.deepEqual(ids("2026"), courses.map(({ id }) => String(id)).sort());
  assert.deepEqual(ids("search"), searchableCourses.map(({ id }) => String(id)).sort());
  assert.equal(count({ scope: "search", year: "2022" }), 0);
  assert.equal(summary.totals.institution_videos, videos.length);
  assert.equal(
    summary.totals.external_videos,
    onlineVideos.filter(({ source }) => source === "youtube").length,
  );
  assert.equal(summary.totals.all_videos, onlineVideos.length);
});

test("the field charts reconcile with the evidence rows in all three cohorts", () => {
  const comparisons = [
    ["라켓 스포츠", 1330, 171],
    ["골프", 227, 81],
    ["당구", 259, 70],
    ["승마", 55, 17],
    ["유연성·스트레칭", 39, 13],
    ["분류 확인 필요", 81, 4],
  ];
  for (const [field, full, recent] of comparisons) {
    assert.equal(count({ field }), full);
    assert.equal(count({ scope: "2026", field }), recent);
    assert.equal(count({ scope: "before_2026", field }), full - recent);
  }
  for (const [scope, cohort] of Object.entries(summary.cohorts)) {
    for (const field of auditFieldOptions(rows))
      assert.equal(count({ scope, field }), cohort.fields[field] ?? 0);
  }
  assert.equal(percent(1330, 2137), "62.24%");
  assert.equal(percent(171, 400), "42.75%");
  assert.equal((100 * (171 / 400 - 1330 / 2137)).toFixed(2), "-19.49");
});

test("all classification states partition the audit and stay within each service scope", () => {
  const statuses = (scope) => Object.values(filterAudit(rows, { ...emptyFilters, scope }).statuses);
  assert.deepEqual(statuses("full"), [2052, 4, 24, 57]);
  assert.deepEqual(statuses("2026"), [394, 2, 4, 0]);
  assert.deepEqual(statuses("search"), [394, 2, 3, 0]);
  const novel = rows.filter((row) => row[8]);
  assert.equal(new Set(novel.map((row) => row[3])).size, 16);
  assert.ok(
    novel.every((row) => row[5] === null && row[6] === "과거 신규 원본 종목 검토" && row[7]),
  );
  assert.deepEqual(summary.novel.examples, { 스피닝바이크: 8, 실내축구: 18, 오카리나: 1 });
});

test("year, field, sport and status filters compose with scope and consistent denominators", () => {
  const result = filterAudit(rows, {
    ...emptyFilters,
    scope: "before_2026",
    year: "2022",
    field: "라켓 스포츠",
    sport: "테니스",
    status: "근거 확인",
  });
  assert.equal(result.scopeCount, 1737);
  assert.equal(result.matches.length, 609);
  assert.deepEqual(result.sports, [{ field: "라켓 스포츠", sport: "테니스", count: 609 }]);
  assert.equal(percent(result.sports[0].count, result.matches.length), "100.00%");
  assert.equal(
    count({ scope: "search", field: "라켓 스포츠", sport: "배드민턴", status: "추정" }),
    2,
  );
  assert.equal(
    count({ year: "1990", status: "과거 신규 원본 종목 검토", sport: unknownSport }),
    24,
  );
  assert.equal(count({ year: "1990", status: "근거 확인" }), 0);
  assert.equal(percent(0, 0), "—");
  assert.ok(auditSportOptions(rows, "라켓 스포츠").includes("배드민턴"));
  assert.ok(!auditSportOptions(rows, "라켓 스포츠").includes("스피닝"));
});

test("year charts and composition use actual totals and retain uncertain 1990 records", () => {
  for (const [year, expected] of [
    ["1990", 24],
    ["2022", 611],
    ["2024", 514],
    ["2025", 472],
    ["2026", 400],
  ]) {
    assert.equal(count({ year }), expected);
    assert.equal(summary.years[year].denominator, expected);
    assert.equal(
      yearlySports(summary.years[year]).reduce((sum, sport) => sum + sport.count, 0),
      expected,
    );
  }
  assert.deepEqual(yearlySports(summary.years[1990]), [{ label: unknownSport, count: 24 }]);
  assert.deepEqual(yearlySports(summary.years[2022])[0], { label: "테니스", count: 609 });
  assert.deepEqual(
    yearlySports(summary.years[2026]).find(({ label }) => label === "배드민턴"),
    { label: "배드민턴", count: 14 },
  );
});

test("coverage rows prove exact, field-only and absent paths without mixing video sources", () => {
  const { coverageSports, coverage, institutionCandidates } = summary;
  const exactInstitution = coverageSports.filter(({ institution }) => institution > 0);
  const exactCombined = coverageSports.filter(
    ({ institution, external }) => institution + external > 0,
  );
  const sumCourses = (sports) => sports.reduce((sum, { courses }) => sum + courses, 0);
  const gaps = coverageSports.filter(
    (row) => row.institution + row.external + row.institutionRelated + row.externalRelated === 0,
  );
  assert.equal(coverageSports.length, 19);
  assert.equal(new Set(coverageSports.map(({ field }) => field)).size, 10);
  assert.equal(sumCourses(coverageSports), 394);
  assert.equal(institutionCandidates, 40);
  assert.equal(exactInstitution.length, coverage.sport_exact_before.count);
  assert.equal(exactCombined.length, coverage.sport_exact_after.count);
  assert.deepEqual(
    [
      exactInstitution.length,
      exactCombined.length,
      sumCourses(exactInstitution),
      sumCourses(exactCombined),
    ],
    [3, 5, 10, 18],
  );
  assert.deepEqual(
    exactCombined
      .filter(({ institution }) => !institution)
      .map(({ sport }) => sport)
      .sort(),
    ["요가", "줌바댄스"],
  );
  assert.deepEqual(
    [gaps.length, sumCourses(gaps), coverage.no_positive_video_path_after_course_records],
    [8, 348, 348],
  );
  assert.deepEqual(
    [coverage.related_field_only_before.length, coverage.related_field_only_after.length],
    [8, 6],
  );
  assert.deepEqual(
    [
      coverage.institution_fields_before.length,
      coverage.institution_or_external_fields_after.length,
    ],
    [4, 4],
  );
});

test("beginner title evidence, sampled level and data quality retain their independent snapshots", () => {
  assert.deepEqual([summary.cohorts.full.title_intro, summary.cohorts[2026].title_intro], [96, 29]);
  assert.deepEqual(summary.beginner, {
    searchTitle: 29,
    institutionTitle: 1,
    institutionCandidateTitle: 0,
    externalTitle: 7,
    externalSampleIntro: 44,
    externalBoth: 2,
    externalHeld: 46,
  });
  const external = summary.totals.external_videos;
  assert.deepEqual(
    [
      external,
      percent(summary.beginner.externalTitle, external),
      percent(summary.beginner.externalSampleIntro, external),
    ],
    [131, "5.34%", "33.59%"],
  );
  assert.equal(summary.asOf, "2026-11-27");
  assert.deepEqual(summary.quality, { paused: 7, timeConflicts: 3, specialEnd: 380, ended: 20 });
  assert.ok(rows.every((row) => row.length === 13 && row[11] === "현재 운영·모집 미확인"));
});
