import { analyzeBeginnerTitle, interestFields } from "../../data/discovery.ts";
import type { Experience, InterestField } from "../../data/discovery.ts";
import {
  analyzedCourses,
  analyzedInstitutionVideos,
  discoveryDistribution,
} from "../../data/public-data-analysis.ts";
import { onlineVideos, searchableCourses } from "../../data/search.ts";
import type { Course, Video } from "../../data/search.ts";

type AnalysisField = (typeof discoveryDistribution)[number]["field"];
type SportField = Exclude<AnalysisField, "분류 확인 필요" | "운동 외 콘텐츠">;
export type RoadmapField = "전체 분야" | SportField;
type Conditions = { field: RoadmapField; sport: string; experience: Experience };
export type RoadmapState = Conditions & { step: number };
export const roadmapSteps = [
  "관심 운동 선택",
  "온라인 영상",
  "오프라인 강좌",
  "운동 계획",
] as const;
export const allRoadmapSports = "전체 종목";
export const initialRoadmap: RoadmapState = {
  step: 0,
  field: "전체 분야",
  sport: allRoadmapSports,
  experience: "상관없음",
};

type Entry<T> = {
  record: T;
  field: SportField;
  sport: string | null;
  inferred: boolean;
  introductoryTitle: boolean;
};
type RoadmapEntry<T> = Entry<T> & { relationship: "sport" | "field" };
const isSportField = (field: AnalysisField): field is SportField =>
  field !== "분류 확인 필요" && field !== "운동 외 콘텐츠";
const isSearchField = (field: string): field is InterestField =>
  interestFields.some((item) => item === field);

const courses: Entry<Course>[] = searchableCourses.flatMap((record) => {
  const classification = analyzedCourses.get(record.id);
  return classification && isSportField(classification.field) && classification.sport
    ? [
        {
          record,
          field: classification.field,
          sport: classification.sport,
          inferred: Boolean(classification.inferred),
          introductoryTitle: analyzeBeginnerTitle(record.title).hasBeginnerKeyword,
        },
      ]
    : [];
});

const videos: Entry<Video>[] = onlineVideos.flatMap((record) => {
  const classification =
    record.source === "institution"
      ? analyzedInstitutionVideos.get(record.id)
      : isSearchField(record.sport)
        ? { field: record.sport, sport: record.discipline }
        : undefined;
  if (!classification || !isSportField(classification.field)) return [];
  if (record.source === "institution" && /접수·신청|행사 후보|예고·홍보/.test(record.type))
    return [];
  return [
    {
      record,
      field: classification.field,
      sport: classification.sport,
      inferred: false,
      introductoryTitle: analyzeBeginnerTitle(record.title).hasBeginnerKeyword,
    },
  ];
});

const catalog: readonly Entry<Course | Video>[] = [...courses, ...videos];
export const roadmapFields: readonly RoadmapField[] = [
  "전체 분야",
  ...interestFields.filter((field) => field !== "기타 운동"),
  ...discoveryDistribution
    .filter(
      ({ field, offline, online }) =>
        !isSearchField(field) && isSportField(field) && offline + online > 0,
    )
    .map(({ field }) => field as SportField),
  "기타 운동",
];

function inField(entry: Entry<Course | Video>, field: RoadmapField) {
  if (field === "전체 분야" || entry.field === field) return true;
  // The existing search filter groups these disciplines under 기타 운동.
  return field === "기타 운동" && !isSearchField(entry.field);
}

export function roadmapSports(field: RoadmapField) {
  const sports = new Set<string>();
  for (const entry of catalog) if (entry.sport && inField(entry, field)) sports.add(entry.sport);
  return [...sports].sort((a, b) => a.localeCompare(b, "ko"));
}

export function updateRoadmap(state: RoadmapState, changes: Partial<Conditions>): RoadmapState {
  const next = { ...state, ...changes };
  const sport = roadmapSports(next.field).includes(next.sport) ? next.sport : allRoadmapSports;
  return { ...next, sport };
}

export function moveRoadmap(state: RoadmapState, index: number): RoadmapState {
  return { ...state, step: Math.max(0, Math.min(roadmapSteps.length - 1, index)) };
}

export function roadmapResults(conditions: Conditions) {
  const { field, sport, experience } = conditions;
  const narrowed = sport !== allRoadmapSports;
  const relatedFields = new Set(
    catalog
      .filter((entry) => inField(entry, field) && entry.sport === sport)
      .map((entry) => entry.field),
  );
  const exact = (entry: Entry<Course | Video>) => narrowed && entry.sport === sport;
  const rankVisit = (entry: Entry<Course | Video>) => {
    const matches = exact(entry);
    return matches ? (entry.inferred ? 1 : 0) : 2;
  };
  const rankExperience = (entry: Entry<Course | Video>) => {
    const { record } = entry;
    const sample = "experience" in record ? record.experience : undefined;
    if (experience === "처음 시작")
      return entry.introductoryTitle ? 0 : sample === "입문·기초" ? 1 : 2;
    if (experience === "운동 경험 있음") return sample === "중급" || sample === "고급" ? 0 : 1;
    return 0;
  };
  const rank = (a: Entry<Course | Video>, b: Entry<Course | Video>) =>
    rankVisit(a) - rankVisit(b) || rankExperience(a) - rankExperience(b);

  function resultsFor<T extends Course | Video>(entries: readonly Entry<T>[]): RoadmapEntry<T>[] {
    return entries
      .filter((entry) => inField(entry, field) && (!narrowed || relatedFields.has(entry.field)))
      .sort(rank)
      .map((entry) => ({ ...entry, relationship: exact(entry) ? "sport" : "field" }));
  }

  // Preserve source video order and the existing default course ID order on ties.
  return { videos: resultsFor(videos), courses: resultsFor(courses) };
}

export function originalVideoLink(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value.trim() : null;
  } catch {
    return null;
  }
}
