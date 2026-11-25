import test from "node:test";
import assert from "node:assert/strict";
import { courses, searchableCourses, videos, onlineVideos } from "./search.ts";
import { rawVideos } from "./sample-data.ts";
import { beginnerChart, courseDiscovery, videoDiscovery } from "./discovery.ts";
import {
  analyzedCourses,
  analyzedInstitutionVideos,
  classifyAnalysisCourse,
  classifyAnalysisVideo,
  discoveryDistribution,
} from "./public-data-analysis.ts";

test("public charts partition all 400 courses and 56 institution videos at both levels", () => {
  assert.deepEqual(
    [courses.length, searchableCourses.length, videos.length, onlineVideos.length],
    [400, 399, 56, 187],
  );
  assert.deepEqual(
    [...analyzedCourses.keys()],
    courses.map(({ id }) => id),
  );
  assert.deepEqual(
    [...analyzedInstitutionVideos.keys()],
    videos.map(({ id }) => id),
  );
  for (const key of ["offline", "online"]) {
    assert.equal(
      discoveryDistribution.reduce((sum, row) => sum + row[key], 0),
      key === "offline" ? 400 : 56,
    );
    for (const row of discoveryDistribution) {
      assert.equal(
        row.detail.reduce((sum, detail) => sum + detail[key], 0),
        row[key],
        row.field,
      );
    }
  }
  assert.deepEqual(
    discoveryDistribution.map(({ field, offline, online }) => [field, offline, online]),
    [
      ["유연성·스트레칭", 13, 2],
      ["근력·체력 향상", 2, 5],
      ["리듬·댄스", 18, 8],
      ["수영·수중운동", 0, 17],
      ["유산소·러닝·사이클", 13, 11],
      ["라켓 스포츠", 171, 0],
      ["구기 스포츠", 6, 0],
      ["무도·격투 스포츠", 5, 0],
      ["골프", 81, 0],
      ["당구", 70, 0],
      ["승마", 17, 0],
      ["기타 운동", 0, 0],
      ["분류 확인 필요", 4, 7],
      ["운동 외 콘텐츠", 0, 6],
    ],
  );
});

test("original course fields rank first and title matches require complete sport terms", () => {
  const classify = (sport, title) => classifyAnalysisCourse({ sport, title });
  assert.equal(classify("골프", "농구 체험").sport, "골프");
  assert.equal(classify("탁구단기속성", "특강").sport, "탁구");
  assert.equal(classify("댄스스포츠", "26. 모던 기초").sport, "모던");
  assert.equal(classify("댄스스포츠", "모던댄스").sport, "댄스스포츠");
  assert.equal(classify("방학특강", "26. 방특 실내승마 화목14시").sport, "실내승마");
  assert.equal(classify("미기재", "검도장 요가매트 대여").field, "분류 확인 필요");
  assert.equal(classify("미기재", "테니스, 농구 체험").field, "분류 확인 필요");
  assert.equal(classify("바디 트레이닝", "바디 트레이닝 (헬스등록필수)").sport, null);
});

test("two documented holiday aliases are flagged as inferred and the search field stays compatible", () => {
  assert.deepEqual(
    [...analyzedCourses].filter(([, result]) => result.inferred).map(([id]) => id),
    [307, 309],
  );
  for (const id of [307, 309]) {
    assert.equal(analyzedCourses.get(id).sport, "배드민턴");
    assert.equal(courseDiscovery.get(id).field, "기타 운동");
  }
  assert.deepEqual(
    [...analyzedCourses].filter(([, result]) => result.sport === null).map(([id]) => id),
    [2073, 2077, 2086, 2137],
  );
});

test("institution topic and content roles are distinguished without reassigning ambiguous titles", () => {
  const classify = (id) => classifyAnalysisVideo(rawVideos.find(({ 순번 }) => Number(순번) === id));
  assert.equal(classify(242).sport, "근력운동");
  assert.equal(classify(323).sport, "수영");
  assert.equal(classify(246).sport, "러닝·워킹");
  assert.deepEqual(
    [...analyzedInstitutionVideos]
      .filter(([, c]) => c.field === "운동 외 콘텐츠")
      .map(([id]) => id),
    [319, 254, 228, 225, 221, 219],
  );
  assert.deepEqual(
    [...analyzedInstitutionVideos]
      .filter(([, c]) => c.field === "분류 확인 필요")
      .map(([id]) => id),
    [304, 291, 290, 256, 240, 235, 232],
  );
  assert.equal(videoDiscovery.get(221).field, "유산소·러닝·사이클");
  assert.equal(classify(222).sport, "러닝");
});

test("title wording counts are independent of sport classification", () => {
  assert.deepEqual(beginnerChart.values, [29, 371, 1, 55]);
  assert.equal(videoDiscovery.get(304).hasBeginnerKeyword, true);
  assert.equal(analyzedInstitutionVideos.get(304).field, "분류 확인 필요");
});
