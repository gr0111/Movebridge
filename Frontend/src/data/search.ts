import { rawCourses, rawVideos } from "./sample-data.ts";
import { assessCourseEligibility } from "./course-eligibility.ts";
import { inferHolidaySport } from "./course-sport.ts";
import { externalVideos } from "./external-videos.ts";

export const days = ["월", "화", "수", "목", "금", "토", "일"];
const decimalTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
};

export const courses = rawCourses.map((row) => ({
  id: Number(row.일련번호),
  title: row.강좌명,
  sport: row.종목 || "미기재",
  days: row.요일_기본표기
    .split(",")
    .map((day) => days.indexOf(day))
    .filter((day) => day >= 0),
  rawDays: row.수강요일,
  parentheticalDays: row.요일_괄호표기,
  rawTime: row.수강시간,
  start: decimalTime(row.시간_시작),
  end: decimalTime(row.시간_종료),
  price: Number(row.수강금액),
  month: row.수강월,
  startDate: row.수강시작일,
  endDate: row.수강종료일,
  audience: row.수강대상 || "미기재",
  longTimeReview: row.시간_장시간검토 === "True",
}));

export const videos = rawVideos.map((row) => ({
  source: "institution" as const,
  id: Number(row.순번),
  title: row.제목,
  sport: row.관심분야,
  date: row.등록일,
  type: row.콘텐츠유형,
  url: row.영상링크,
}));
export const onlineVideos = [...videos, ...externalVideos];

export const courseEligibility = new Map(
  courses.map((course) => [course.id, assessCourseEligibility(course)]),
);
export const searchableCourses = courses.filter(
  (course) => courseEligibility.get(course.id)!.searchableAsCourse,
);
export const excludedCourses = courses.filter(
  (course) => !courseEligibility.get(course.id)!.searchableAsCourse,
);
export const courseExclusionSummary = [
  ...new Set(excludedCourses.map((course) => courseEligibility.get(course.id)!.exclusionReason!)),
].map((reason) => ({
  reason,
  count: excludedCourses.filter(
    (course) => courseEligibility.get(course.id)!.exclusionReason === reason,
  ).length,
}));

export type Course = (typeof courses)[number];
export type Video = (typeof onlineVideos)[number];
export type Filters = {
  mode: "all" | "offline" | "online";
  sport: string;
  days: number[];
  start: string;
  end: string;
  budget: number;
};
export const sports = [
  "전체 종목",
  ...new Set(courses.map((course) => course.sport)),
  ...new Set(videos.map((video) => video.sport)),
];
const normalize = (value: string) => value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
export const matchesQuery = (title: string, sport: string, query: string) =>
  query === "전체 종목" ||
  normalize(title).includes(normalize(query)) ||
  normalize(sport).includes(normalize(query));

export const matchesCourseQuery = (course: Pick<Course, "title" | "sport">, query: string) => {
  const inferred = inferHolidaySport(course);
  return (
    matchesQuery(course.title, course.sport, query) ||
    Boolean(inferred && matchesQuery("", inferred.sport, query))
  );
};

export function searchCourses(filters: Filters) {
  return searchableCourses.filter(
    (course) =>
      matchesCourseQuery(course, filters.sport) &&
      (!filters.days.length || filters.days.every((day) => course.days.includes(day))) &&
      course.start >= Number(filters.start) &&
      course.end <= Number(filters.end) &&
      course.price <= filters.budget,
  );
}
export const matchesVideoQuery = (video: Video, query: string) =>
  matchesQuery(video.title, video.sport, query) ||
  (video.source === "youtube" &&
    (matchesQuery("", video.discipline, query) ||
      normalize(video.difficulty) === normalize(query) ||
      normalize(video.experience) === normalize(query)));

export const searchVideos = (query: string) =>
  onlineVideos.filter((video) => matchesVideoQuery(video, query));

// Convenience groupings follow the supplied dictionary, not a course-to-video identity.
const interestGroups: Record<string, string> = {
  요가: "유연성·스트레칭",
  필라테스: "유연성·스트레칭",
  스트레칭: "유연성·스트레칭",
  SNPE: "유연성·스트레칭",
  헬스: "근력·체력 향상",
  TRX: "근력·체력 향상",
  수영: "수영·수중운동",
  접영: "수영·수중운동",
  평영: "수영·수중운동",
  배영: "수영·수중운동",
  라인댄스: "리듬·댄스",
  줌바댄스: "리듬·댄스",
  댄스스포츠: "리듬·댄스",
  로드사이클: "유산소·러닝·사이클",
  스피닝: "유산소·러닝·사이클",
};
export function searchRelatedVideos(query: string) {
  if (query === "전체 종목") return [];
  const group = interestGroups[query];
  if (!group) return [];
  return videos.filter(
    (video) => video.sport === group && !matchesQuery(video.title, video.sport, query),
  );
}

const count = (test: (course: Course) => boolean) => courses.filter(test).length;
const sportCounts = [...new Set(courses.map((course) => course.sport))]
  .map((sport) => ({ label: sport, value: count((course) => course.sport === sport) }))
  .sort((a, b) => b.value - a.value);
export const sampleCharts = [
  {
    title: "원본 종목 표기별 강좌 기록 수",
    labels: [...sportCounts.slice(0, 5).map((item) => item.label), "그 외 종목 표기"],
    values: [
      ...sportCounts.slice(0, 5).map((item) => item.value),
      sportCounts.slice(5).reduce((sum, item) => sum + item.value, 0),
    ],
  },
  {
    title: "수강금액 구간별 강좌 기록 수",
    labels: ["5만원 이하", "5–10만원", "10–15만원", "15만원 초과"],
    values: [
      count((c) => c.price <= 50000),
      count((c) => c.price > 50000 && c.price <= 100000),
      count((c) => c.price > 100000 && c.price <= 150000),
      count((c) => c.price > 150000),
    ],
  },
  {
    title: "요일별 강좌 기록 현황",
    labels: days,
    values: days.map((_, index) => count((c) => c.days.includes(index))),
  },
  {
    title: "시작 시간대별 기록 현황",
    labels: ["06–09시", "09–12시", "12–15시", "15–18시", "18–22시"],
    values: [
      [6, 9],
      [9, 12],
      [12, 15],
      [15, 18],
      [18, 22],
    ].map(([start, end]) => count((c) => c.start >= start && c.start < end)),
  },
];
