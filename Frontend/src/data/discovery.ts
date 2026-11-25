import {
  courses,
  videos,
  onlineVideos,
  searchCourses,
  searchVideos,
  searchRelatedVideos,
  matchesVideoQuery,
  searchableCourses,
  matchesCourseQuery,
} from "./search.ts";
import { classifyAnalysisCourse } from "./public-data-analysis.ts";
import type { Course, Video, Filters } from "./search.ts";

export const interestFields = [
  "유연성·스트레칭",
  "근력·체력 향상",
  "리듬·댄스",
  "수영·수중운동",
  "유산소·러닝·사이클",
  "기타 운동",
] as const;
export type InterestField = (typeof interestFields)[number];
export type ContentField = InterestField | "분류 확인 필요" | "운동 외 콘텐츠";
export const experienceOptions = ["상관없음", "처음 시작", "운동 경험 있음"] as const;
export type Experience = (typeof experienceOptions)[number];
export type DiscoveryFilters = Filters & {
  field: InterestField | "전체 분야";
  experience: Experience;
};
export type ResultSort = "default" | "price" | "time";

// Explicit lexical rules only. An absent match is not automatically an "other sport".
export const fieldRules: { field: InterestField; terms: string[] }[] = [
  { field: "유연성·스트레칭", terms: ["요가", "필라테스", "스트레칭", "SNPE"] },
  { field: "근력·체력 향상", terms: ["헬스", "TRX", "근력"] },
  { field: "리듬·댄스", terms: ["댄스", "줌바", "발레"] },
  { field: "수영·수중운동", terms: ["수영", "접영", "배영", "평영", "아쿠아", "싱크로"] },
  {
    field: "유산소·러닝·사이클",
    terms: ["로드사이클", "사이클", "스피닝", "러닝", "워킹", "트램폴린"],
  },
  {
    field: "기타 운동",
    terms: ["검도", "골프", "농구", "배드민턴", "탁구", "테니스", "당구", "승마"],
  },
];
const normalize = (value: string) => value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

/** Original wording, not a difficulty rating. No description field exists in these samples. */
export function analyzeBeginnerTitle(title: string) {
  const matches =
    title.match(
      /입문|초급(?!\s*[·./~–-]?\s*(?:중급|고급))|기초(?!\s*(?:대사량|체력))|\bBeginner\b/gi,
    ) || [];
  const beginnerMatchedTerms = [...new Set(matches)];
  return {
    hasBeginnerKeyword: beginnerMatchedTerms.length > 0,
    beginnerMatchedTerms,
    beginnerPriority: beginnerMatchedTerms.length ? 1 : 0,
  };
}

export function classifyCourse(
  course: Pick<Course, "title" | "sport">,
): {
  field: ContentField;
  evidence: string;
} {
  const { field, evidence } = classifyAnalysisCourse(course);
  if (field === "분류 확인 필요" || field === "운동 외 콘텐츠") return { field, evidence };
  return { field: interestFields.find((interest) => interest === field) ?? "기타 운동", evidence };
}
export function classifyVideo(video: Pick<Video, "title" | "sport">): {
  field: ContentField;
  evidence: string;
} {
  if (interestFields.some((field) => field === video.sport))
    return { field: video.sport as InterestField, evidence: "첨부 CSV 관심분야 필드" };
  if (video.sport === "운동 외 콘텐츠")
    return { field: "운동 외 콘텐츠", evidence: "첨부 CSV 관심분야 필드" };
  // Do not turn a reviewed-as-uncertain field into a sport based on an ambiguous title.
  return { field: "분류 확인 필요", evidence: "첨부 CSV의 관심분야 검토 상태 유지" };
}
export const courseDiscovery = new Map(
  courses.map((course) => [
    course.id,
    { ...classifyCourse(course), ...analyzeBeginnerTitle(course.title) },
  ]),
);
export const videoDiscovery = new Map(
  onlineVideos.map((video) => [
    video.id,
    { ...classifyVideo(video), ...analyzeBeginnerTitle(video.title) },
  ]),
);

type DetailContext = Pick<DiscoveryFilters, "field" | "mode">;
export type DetailOptions = { sports: string[]; videoTitles: string[] };
const inDetailField = (field: ContentField, context: DetailContext) =>
  context.field === "전체 분야" || context.field === field;

// Reuse the same classified records as search/analysis. A video mentioning golf
// inside a strength exercise does not turn "골프" into a strength sport option.
const detailSportFields = new Map<string, Set<ContentField>>();
const addDetailSport = (sport: string, field: ContentField) => {
  const fields = detailSportFields.get(sport) || new Set<ContentField>();
  fields.add(field);
  detailSportFields.set(sport, fields);
};
for (const course of searchableCourses) {
  if (course.sport !== "미기재")
    addDetailSport(course.sport, courseDiscovery.get(course.id)!.field);
}
for (const video of videos) {
  const field = videoDiscovery.get(video.id)!.field;
  for (const rule of fieldRules) {
    if (rule.field !== field) continue;
    for (const term of rule.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Keep literal source words, not substrings such as 댄스 in 라인댄스 or
      // 근력 in 근력운동. Existing CSV sport names remain available above.
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(video.title))
        addDetailSport(term, field);
    }
  }
}

/** Options depend only on the field, mode and real records, never experience or budget. */
export function getDetailOptions(context: DetailContext): DetailOptions {
  const offline =
    context.mode === "online"
      ? []
      : searchableCourses.filter((course) =>
          inDetailField(courseDiscovery.get(course.id)!.field, context),
        );
  const online =
    context.mode === "offline"
      ? []
      : onlineVideos.filter((video) => inDetailField(videoDiscovery.get(video.id)!.field, context));
  const sports = [...detailSportFields]
    .filter(
      ([sport, fields]) =>
        [...fields].some((field) => inDetailField(field, context)) &&
        (offline.some(
          (course) =>
            fields.has(courseDiscovery.get(course.id)!.field) && matchesCourseQuery(course, sport),
        ) ||
          online.some(
            (video) =>
              fields.has(videoDiscovery.get(video.id)!.field) &&
              matchesVideoQuery(video, sport),
          )),
    )
    .map(([sport]) => sport);
  const externalSports = online.flatMap((video) =>
    video.source === "youtube" ? [video.discipline] : [],
  );
  return {
    sports: [...new Set([...sports, ...externalSports])],
    videoTitles: [...new Set(online.map((video) => video.title))],
  };
}

export function isDetailSelectionValid(query: string, context: DetailContext) {
  if (!query || query === "전체 종목") return true;
  const options = getDetailOptions(context);
  const exact = (value: string) => normalize(value) === normalize(query);
  if ([...options.sports, ...options.videoTitles].some(exact)) return true;
  // A known selection must still occur in the new context's list.
  if (
    [...detailSportFields.keys()].some(exact) ||
    onlineVideos.some((video) =>
      exact(video.title) || (video.source === "youtube" && exact(video.discipline)),
    )
  )
    return false;
  // Preserve free-text search when it still has source evidence in this context.
  return (
    (context.mode !== "online" &&
      searchableCourses.some(
        (course) =>
          inDetailField(courseDiscovery.get(course.id)!.field, context) &&
          matchesCourseQuery(course, query),
      )) ||
    (context.mode !== "offline" &&
      onlineVideos.some(
        (video) =>
          inDetailField(videoDiscovery.get(video.id)!.field, context) &&
          matchesVideoQuery(video, query),
      ))
  );
}

export function updateDiscoveryFilter<K extends keyof DiscoveryFilters>(
  filters: DiscoveryFilters,
  key: K,
  value: DiscoveryFilters[K],
): DiscoveryFilters {
  const next = { ...filters, [key]: value };
  if ((key === "field" || key === "mode") && !isDetailSelectionValid(next.sport, next))
    return { ...next, sport: "전체 종목" };
  return next;
}

function isBeginnerRecord(record: { title: string; source?: string; experience?: string }) {
  return record.source === "youtube"
    ? record.experience === "입문·기초"
    : analyzeBeginnerTitle(record.title).hasBeginnerKeyword;
}

function matchesVideoExperience(video: Video, experience: Experience) {
  if (video.source === "institution" || experience === "상관없음") return true;
  return experience === "처음 시작"
    ? isBeginnerRecord(video)
    : video.experience === "중급" || video.experience === "고급";
}

export function groupByBeginner<T extends { title: string }>(records: T[]) {
  return {
    first: records.filter(isBeginnerRecord),
    other: records.filter((record) => !isBeginnerRecord(record)),
  };
}
export function searchDiscovery(filters: DiscoveryFilters, sort: ResultSort = "default") {
  const inField = (field: ContentField) => filters.field === "전체 분야" || filters.field === field;
  const prioritize = filters.experience === "처음 시작" && sort === "default";
  const priority = (a: Course | Video, b: Course | Video) =>
    prioritize
      ? Number(isBeginnerRecord(b)) - Number(isBeginnerRecord(a))
      : 0;
  const offline = (filters.mode === "online" ? [] : searchCourses(filters))
    .filter((course) => inField(courseDiscovery.get(course.id)!.field))
    .sort(
      (a, b) =>
        (sort === "price"
          ? a.price - b.price
          : sort === "time"
            ? a.start - b.start
            : priority(a, b)) || a.id - b.id,
    );
  const online = (filters.mode === "offline" ? [] : searchVideos(filters.sport))
    .filter((video) => inField(videoDiscovery.get(video.id)!.field))
    .filter((video) => matchesVideoExperience(video, filters.experience))
    .sort(priority);
  const related =
    filters.mode === "offline"
      ? []
      : searchRelatedVideos(filters.sport)
          .filter(
            (video) =>
              inField(videoDiscovery.get(video.id)!.field) &&
              !online.some((match) => match.id === video.id),
          )
          .sort(priority);
  return { offline, online, related, prioritize };
}

export const beginnerTotals = {
  offline: [...courseDiscovery.values()].filter((record) => record.hasBeginnerKeyword).length,
  online: videos.filter((video) => videoDiscovery.get(video.id)!.hasBeginnerKeyword).length,
};
export const beginnerChart = {
  title: "원본 제목의 입문 관련 표현 유무",
  labels: ["강좌 · 표현 포함", "강좌 · 표현 없음", "영상 · 표현 포함", "영상 · 표현 없음"],
  values: [
    beginnerTotals.offline,
    courses.length - beginnerTotals.offline,
    beginnerTotals.online,
    videos.length - beginnerTotals.online,
  ],
};
