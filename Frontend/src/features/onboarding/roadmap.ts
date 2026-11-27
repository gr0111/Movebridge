import { analyzeBeginnerTitle } from "../../data/discovery.ts";
import { getCourseStatus } from "../../data/course-status.ts";
import type { Experience } from "../../data/discovery.ts";
import {
  canonicalSport, interestFields, isInterestField, linkableVideos,
  matchesInterestField, topicRelationship, videoTitleIntroTerms,
} from "../../data/content-linkage.ts";
import type { FieldSelection, InterestField } from "../../data/content-linkage.ts";
import { analyzedCourses } from "../../data/public-data-analysis.ts";
import { searchableCourses } from "../../data/search.ts";
import type { Course, Video } from "../../data/search.ts";

export type RoadmapField = FieldSelection;
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
  field: InterestField;
  sport: string | null;
  inferred: boolean;
  introductoryTitle: boolean;
};
type RoadmapEntry<T> = Entry<T> & { relationship: "sport" | "field" };
const courses: Entry<Course>[] = searchableCourses.flatMap((record) => {
  const classification = analyzedCourses.get(record.id);
  return classification && isInterestField(classification.field) && classification.sport &&
    getCourseStatus(record).canRecommend
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

const videos: Entry<Video>[] = linkableVideos.map((entry) => ({
  ...entry,
  inferred: false,
  introductoryTitle: videoTitleIntroTerms(entry.record.title).length > 0,
}));

const catalog: readonly Entry<Course | Video>[] = [...courses, ...videos];
export const roadmapFields: readonly RoadmapField[] = [
  "전체 분야",
  ...interestFields,
];

function inField(entry: Entry<Course | Video>, field: RoadmapField) {
  return matchesInterestField(entry.field, field);
}

export function roadmapSports(field: RoadmapField) {
  const sports = new Set<string>();
  for (const entry of catalog) if (entry.sport && inField(entry, field)) sports.add(entry.sport);
  return [...sports].sort((a, b) => a.localeCompare(b, "ko"));
}

export function updateRoadmap(state: RoadmapState, changes: Partial<Conditions>): RoadmapState {
  const next = { ...state, ...changes };
  const selectedSport = canonicalSport(next.sport);
  const sport = roadmapSports(next.field).includes(selectedSport) ? selectedSport : allRoadmapSports;
  return { ...next, sport };
}

export function moveRoadmap(state: RoadmapState, index: number): RoadmapState {
  return { ...state, step: Math.max(0, Math.min(roadmapSteps.length - 1, index)) };
}

export function roadmapResults(conditions: Conditions) {
  const { field, experience } = conditions;
  const sport = canonicalSport(conditions.sport);
  const narrowed = sport !== allRoadmapSports;
  const topics = narrowed ? catalog.filter((entry) => inField(entry, field) && entry.sport === sport) : [];
  const rankVisit = (entry: RoadmapEntry<Course | Video>) =>
    entry.relationship === "sport" ? (entry.inferred ? 1 : 0) : 2;
  const rankExperience = (entry: Entry<Course | Video>) => {
    const { record } = entry;
    const sample = "experience" in record ? record.experience : undefined;
    if (experience === "처음 시작")
      return entry.introductoryTitle ? 0 : sample === "입문·기초" ? 1 : 2;
    if (experience === "운동 경험 있음") return sample === "중급" || sample === "고급" ? 0 : 1;
    return 0;
  };
  const rank = (a: RoadmapEntry<Course | Video>, b: RoadmapEntry<Course | Video>) =>
    rankVisit(a) - rankVisit(b) || rankExperience(a) - rankExperience(b);

  function resultsFor<T extends Course | Video>(entries: readonly Entry<T>[]): RoadmapEntry<T>[] {
    return entries
      .flatMap<RoadmapEntry<T>>((entry) => {
        if (!inField(entry, field)) return [];
        const relationship = narrowed ? topicRelationship(entry, topics) : "field";
        return relationship ? [{ ...entry, relationship }] : [];
      })
      .sort(rank);
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
