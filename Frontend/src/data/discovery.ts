import {
  courses,
  videos,
  onlineVideos,
  searchCourses,
  matchesVideoQuery,
  searchableCourses,
  matchesCourseQuery,
} from "./search.ts";
import { analyzedCourses, classifyAnalysisCourse } from "./public-data-analysis.ts";
import {
  canonicalSport, isInterestField, isStandardSport, linkedVideos, linkableVideos,
  matchesInterestField, sportTopics,
} from "./content-linkage.ts";
import type { FieldSelection, InterestField } from "./content-linkage.ts";
import type { Course, Video, Filters } from "./search.ts";

export { interestFields } from "./content-linkage.ts";
export type ContentField = InterestField | "분류 확인 필요" | "운동 외 콘텐츠";
export const experienceOptions = ["상관없음", "처음 시작", "운동 경험 있음"] as const;
export type Experience = (typeof experienceOptions)[number];
export type DiscoveryFilters = Filters & {
  field: FieldSelection;
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
  { field: "라켓 스포츠", terms: ["배드민턴", "탁구", "테니스"] },
  { field: "골프", terms: ["골프"] },
  { field: "당구", terms: ["당구"] },
  { field: "승마", terms: ["실내승마"] },
  { field: "구기 스포츠", terms: ["농구"] },
  { field: "무도·격투 스포츠", terms: ["검도"] },
  {
    field: "기타 운동",
    terms: ["라켓 스포츠", "골프", "당구", "승마", "구기 스포츠", "무도·격투 스포츠"],
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

export { classifyAnalysisCourse as classifyCourse };
export function classifyVideo(video: Pick<Video, "title" | "sport">): {
  field: ContentField;
  evidence: string;
} {
  if (isInterestField(video.sport))
    return { field: video.sport, evidence: "첨부 CSV 관심분야 필드" };
  if (video.sport === "운동 외 콘텐츠")
    return { field: "운동 외 콘텐츠", evidence: "첨부 CSV 관심분야 필드" };
  // Do not turn a reviewed-as-uncertain field into a sport based on an ambiguous title.
  return { field: "분류 확인 필요", evidence: "첨부 CSV의 관심분야 검토 상태 유지" };
}
export const courseDiscovery = new Map(
  courses.map((course) => [
    course.id,
    { ...analyzedCourses.get(course.id)!, ...analyzeBeginnerTitle(course.title) },
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
  matchesInterestField(field, context.field);

/** Options depend only on the field, mode and real records, never experience or budget. */
export function getDetailOptions(context: DetailContext): DetailOptions {
  const offline = context.mode === "online" ? [] : searchableCourses;
  const online =
    context.mode === "offline"
      ? []
      : onlineVideos.filter((video) => inDetailField(videoDiscovery.get(video.id)!.field, context));
  const onlineTopics = context.mode === "offline" ? [] : linkableVideos;
  const topics = [...offline.map(({ id }) => courseDiscovery.get(id)!), ...onlineTopics];
  const sports = topics.flatMap(({ field, sport }) =>
    sport && inDetailField(field, context) ? [sport] : [],
  );
  return {
    sports: [...new Set(sports)],
    videoTitles: [...new Set(online.map((video) => video.title))],
  };
}

export function isDetailSelectionValid(query: string, context: DetailContext) {
  if (!query || query === "전체 종목") return true;
  const options = getDetailOptions(context);
  const exact = (value: string) => normalize(value) === normalize(query);
  if (isStandardSport(query)) return options.sports.includes(canonicalSport(query));
  if (options.videoTitles.some(exact)) return true;
  // A known selection must still occur in the new context's list.
  if (onlineVideos.some((video) => exact(video.title))) return false;
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
  const inField = (field: ContentField) => matchesInterestField(field, filters.field);
  const standardSport = isStandardSport(filters.sport) ? canonicalSport(filters.sport) : null;
  const topics = standardSport ? sportTopics(standardSport, filters.field) : [];
  const links = linkedVideos(topics);
  const matchesExperience = (video: Video) => matchesVideoExperience(video, filters.experience);
  const prioritize = filters.experience === "처음 시작" && sort === "default";
  const priority = (a: Course | Video, b: Course | Video) =>
    prioritize
      ? Number(isBeginnerRecord(b)) - Number(isBeginnerRecord(a))
      : 0;
  const offline = (filters.mode === "online" ? [] : searchCourses({
    ...filters, sport: standardSport ? "전체 종목" : filters.sport,
  }))
    .filter((course) => {
      const topic = courseDiscovery.get(course.id)!;
      return inField(topic.field) && (!standardSport || topic.sport === standardSport);
    })
    .sort(
      (a, b) =>
        (sort === "price"
          ? a.price - b.price
          : sort === "time"
            ? a.start - b.start
            : priority(a, b)) || a.id - b.id,
    );
  const sameSport = filters.mode === "offline" ? [] : links.sameSport.filter(matchesExperience).sort(priority);
  const sameField = filters.mode === "offline" ? [] : links.sameField.filter(matchesExperience).sort(priority);
  const directLinks = new Set(sameSport);
  const online = (filters.mode === "offline" ? [] : onlineVideos)
    .filter((video) => directLinks.has(video) || (
      inField(videoDiscovery.get(video.id)!.field) && matchesVideoQuery(video, filters.sport)
    ))
    .filter(matchesExperience)
    .sort(priority);
  const hasVideoPath = links.sameSport.length + links.sameField.length > 0;
  return { offline, online, sameSport, sameField, standardSport: topics.length ? standardSport : null, hasVideoPath, prioritize };
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
