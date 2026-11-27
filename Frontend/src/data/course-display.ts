import type { Course } from "./search";
import { resolveCourseSport } from "./course-sport.ts";
import { getCourseStatus, sourcePauseTag } from "./course-status.ts";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const tagPattern =
  /(?<![가-힣])(?:성인남여및청소년|헬스등록필수|성인남여|임직원|청소년|어린이|초\.중급|초급|중급|기초|성인)(?![가-힣])/gu;

/** Presentation only: searches, grouping, IDs and raw values remain untouched. */
export function getCourseDisplay(course: Course) {
  const rawTitle = course.title;
  const sport = resolveCourseSport(course);
  const status = getCourseStatus(course);
  const displayTags = [
    ...new Set([
      ...(rawTitle.match(tagPattern) || []),
      ...(course.audience && course.audience !== "미기재" ? [course.audience] : []),
    ]),
  ].sort((a, b) => Number(a === "헬스등록필수") - Number(b === "헬스등록필수"));
  const baseDays = course.rawDays
    .replace(/\([^)]*\)/g, "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
  const daysKnown = baseDays.length > 0 && baseDays.every((day) => weekdays.includes(day));

  // Require an explicit instructor marker. Bare trailing names are not parsed.
  const instructors = [
    ...new Set(
      [...rawTitle.matchAll(/\*\s*([가-힣]{2,4})\s*강사(?![가-힣])/g)].map((match) => match[1]),
    ),
  ];
  const additionalTypes = [...status.program.tags];
  if (course.sport === "방학특강" || rawTitle.includes("방학특강"))
    additionalTypes.push("방학특강");
  if (rawTitle.includes("주말복수")) additionalTypes.push("주말복수");
  if (/어린이\s*특별\s*강습/.test(rawTitle)) additionalTypes.push("어린이 특별 강습");
  else if (/특별\s*강습/.test(rawTitle)) additionalTypes.push("특별 강습");
  if (/국제식\s*3쿠션/.test(rawTitle)) additionalTypes.push("국제식 3쿠션");
  else if (rawTitle.includes("3쿠션")) additionalTypes.push("3쿠션");
  for (const match of rawTitle.matchAll(/(?:그룹|입문)\s*패키지/g)) additionalTypes.push(match[0]);
  if (course.sport.includes("단기속성") || rawTitle.includes("단기속성"))
    additionalTypes.push("단기속성");
  if (/커플,?\s*부부반/.test(rawTitle)) additionalTypes.push("커플·부부반");
  if (status.pausedInSource) additionalTypes.push(sourcePauseTag);
  const packageDetails = [
    ...rawTitle.matchAll(
      /\(((?:개인|입문|그룹|피팅)\s*\d+회(?:\s*\+\s*(?:개인|입문|그룹|피팅)\s*\d+회)*)\)/g,
    ),
  ].map((match) => match[1]);
  const dayLabel = daysKnown ? baseDays.join("·") : "요일 확인 필요";
  const timeLabel = status.timeLabel ?? "시간 확인 필요";
  return {
    rawTitle,
    ...sport,
    displayTitle: `[${dayLabel}] ${sport.displaySport} (${timeLabel})`,
    displayTags,
    instructors,
    additionalTypes: [...new Set(additionalTypes)],
    packageDetails,
    status,
    timeConflicts: status.timeConflicts,
    needsReview: !daysKnown || !status.timeLabel || sport.sportNeedsReview || status.timeConflicts.length > 0,
  };
}
