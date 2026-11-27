import { analyzedCourses, analyzedInstitutionVideos } from "./public-data-analysis.ts";
import type { AnalysisField } from "./public-data-analysis.ts";
import { onlineVideos, searchableCourses } from "./search.ts";
import type { Video } from "./search.ts";

// Phase 2 mapping v1: the previous search category is the union of these analysis fields.
export const otherExerciseFields = [
  "라켓 스포츠", "골프", "당구", "승마", "구기 스포츠", "무도·격투 스포츠",
] as const satisfies readonly AnalysisField[];
export const interestFields = [
  "유연성·스트레칭", "근력·체력 향상", "리듬·댄스", "수영·수중운동", "유산소·러닝·사이클",
  ...otherExerciseFields, "기타 운동",
] as const satisfies readonly AnalysisField[];
export type InterestField = (typeof interestFields)[number];
export type FieldSelection = InterestField | "전체 분야";

export const isInterestField = (field: string): field is InterestField =>
  interestFields.some((candidate) => candidate === field);

export function matchesInterestField(field: AnalysisField, selection: FieldSelection) {
  return selection === "전체 분야" || selection === field ||
    (selection === "기타 운동" && otherExerciseFields.some((other) => other === field));
}

// Phase 2 found that the verified CSV's 줌바 and the course's 줌바댄스 name the same activity.
// Spinning/road cycling and gym routines/헬스 share a field and keep distinct sport names.
export function canonicalSport(sport: string) {
  const name = sport.trim();
  return name === "줌바" ? "줌바댄스" : name;
}

export function videoTitleIntroTerms(title: string) {
  return [...new Set(title.match(/입문|처음|초급|기초|\bBeginner\b/gi) ?? [])];
}

type Topic = { field: InterestField; sport: string | null };

export function videoLinkTopic(video: Video): Topic | null {
  if (video.source === "youtube") {
    return isInterestField(video.sport)
      ? { field: video.sport, sport: canonicalSport(video.discipline) || null }
      : null;
  }
  const classification = analyzedInstitutionVideos.get(video.id);
  if (!classification || !isInterestField(classification.field) ||
      /접수·신청|행사 후보|예고·홍보/.test(video.type)) return null;
  return { field: classification.field, sport: classification.sport };
}

export const linkableVideos = onlineVideos.flatMap((record) => {
  const topic = videoLinkTopic(record);
  return topic ? [{ record, ...topic }] : [];
});

const topicFields = new Map<string, Set<InterestField>>();
for (const topic of [...searchableCourses.map(({ id }) => analyzedCourses.get(id)!), ...linkableVideos]) {
  if (!topic.sport || !isInterestField(topic.field)) continue;
  const fields = topicFields.get(topic.sport) ?? new Set<InterestField>();
  fields.add(topic.field);
  topicFields.set(topic.sport, fields);
}

export function isStandardSport(sport: string) {
  return topicFields.has(canonicalSport(sport));
}

export function sportTopics(sport: string, selection: FieldSelection): Topic[] {
  const name = canonicalSport(sport);
  const fields = topicFields.get(name);
  return fields
    ? [...fields].filter((field) => matchesInterestField(field, selection)).map((field) => ({ field, sport: name }))
    : [];
}

export function topicRelationship(candidate: Topic, topics: readonly Topic[]) {
  let sameField = false;
  for (const topic of topics) {
    if (topic.field !== candidate.field) continue;
    if (candidate.sport && topic.sport === candidate.sport) return "sport";
    sameField = true;
  }
  return sameField ? "field" : null;
}

export function linkedVideos(topics: readonly Topic[]) {
  const sameSport: Video[] = [];
  const sameField: Video[] = [];
  for (const video of linkableVideos) {
    const relationship = topicRelationship(video, topics);
    if (relationship === "sport") sameSport.push(video.record);
    if (relationship === "field") sameField.push(video.record);
  }
  return { sameSport, sameField };
}
