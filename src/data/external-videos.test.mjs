import test from "node:test";
import assert from "node:assert/strict";
import { externalVideos } from "./external-videos.ts";
import { searchDiscovery, groupByBeginner, getDetailOptions } from "./discovery.ts";
import { videos } from "./search.ts";

const filters = {
  mode: "online",
  field: "전체 분야",
  experience: "상관없음",
  sport: "전체 종목",
  days: [],
  start: "06",
  end: "22",
  budget: Infinity,
};

test("external records load once with original watch and thumbnail URLs", () => {
  const { online } = searchDiscovery(filters);
  assert.equal(online.length, 187);
  assert.equal(new Set(online.map((video) => video.id)).size, 187);
  assert.deepEqual(
    online.filter((video) => video.source === "institution"),
    videos,
  );
  assert.equal(externalVideos.length, 131);
  assert.equal(new Set(externalVideos.map((video) => video.youtubeId)).size, 131);
  for (const video of externalVideos) {
    assert.match(video.youtubeId, /^[A-Za-z0-9_-]{11}$/);
    assert.equal(video.url, `https://www.youtube.com/watch?v=${video.youtubeId}`);
    assert.equal(video.thumbnail, `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`);
    assert.ok(video.channel && video.observedRange && video.difficultyEvidence);
  }
  assert.ok(videos.every((video) => !/youtube\.com|youtu\.be/.test(video.url)));
});

test("field, discipline and experience follow the verified CSV metadata", () => {
  const context = { ...filters, field: "근력·체력 향상", sport: "푸쉬업" };
  assert.ok(getDetailOptions(context).sports.includes("푸쉬업"));
  const matches = searchDiscovery(context).online.filter((video) => video.source === "youtube");
  assert.ok(matches.some((video) => video.discipline === "푸쉬업"));
  assert.ok(matches.every((video) => video.sport === context.field));
  const external = (experience) =>
    searchDiscovery({ ...filters, experience }).online.filter(
      (video) => video.source === "youtube",
    );
  assert.equal(external("처음 시작").length, 44);
  assert.ok(external("처음 시작").every((video) => video.experience === "입문·기초"));
  assert.equal(external("운동 경험 있음").length, 34);
  assert.ok(
    external("운동 경험 있음").every((video) => ["중급", "고급"].includes(video.experience)),
  );
  const pending = external("상관없음").filter((video) => video.difficulty === "판단 보류");
  assert.equal(pending.length, 46);
  assert.equal(groupByBeginner(pending).first.length, 0);
  assert.deepEqual(
    searchDiscovery({ ...filters, sport: "판단 보류" }).online.filter((video) => video.source === "youtube"),
    pending,
  );
});
