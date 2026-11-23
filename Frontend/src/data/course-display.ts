import type { Course } from "./search";
import { resolveCourseSport } from "./course-sport.ts";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const tagPattern =
  /(?<![가-힣])(?:성인남여및청소년|헬스등록필수|성인남여|임직원|청소년|어린이|초\.중급|초급|중급|기초|성인)(?![가-힣])/gu;
const clockPattern = "(?:\\d{1,2}:\\d{2}|\\d{4}|\\d{1,2})";
const clockValue = (value: string) => {
  const clean = value.replace(/시$/, "").trim();
  const [hour, minute] = clean.includes(":")
    ? clean.split(":").map(Number)
    : clean.length === 4
      ? [Number(clean.slice(0, 2)), Number(clean.slice(2))]
      : [Number(clean), 0];
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
};

/** Presentation only: searches, grouping, IDs and raw values remain untouched. */
export function getCourseDisplay(course: Course) {
  const rawTitle = course.title;
  const sport = resolveCourseSport(course);
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
  const rawTimeMatch = course.rawTime.match(
    /^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/,
  );
  const start = rawTimeMatch ? clockValue(`${rawTimeMatch[1]}:${rawTimeMatch[2]}`) : null;
  const end = rawTimeMatch ? clockValue(`${rawTimeMatch[3]}:${rawTimeMatch[4]}`) : null;
  const timeKnown = start !== null && end !== null && end > start;
  const ranges = new RegExp(
    `(?<!\\d)(${clockPattern})\\s*[-~–]\\s*(${clockPattern})(?:시)?(?!\\d)`,
    "g",
  );
  const titleRanges = [...rawTitle.matchAll(ranges)];
  const timeConflicts = titleRanges
    .filter((match) => !timeKnown || clockValue(match[1]) !== start || clockValue(match[2]) !== end)
    .map((match) => match[0]);
  if (!titleRanges.length) {
    for (const match of rawTitle.matchAll(/(?<![\d:])(?:\d{1,2}:\d{2}|\d{1,2}시)(?![\d:])/g))
      if (!timeKnown || clockValue(match[0]) !== start) timeConflicts.push(match[0]);
  }

  // Require an explicit instructor marker. Bare trailing names are not parsed.
  const instructors = [
    ...new Set(
      [...rawTitle.matchAll(/\*\s*([가-힣]{2,4})\s*강사(?![가-힣])/g)].map((match) => match[1]),
    ),
  ];
  const additionalTypes: string[] = [];
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
  if (rawTitle.includes("일시중지"))
    additionalTypes.push("원본에 ‘일시중지’ 표기 · 현재 상태는 미확인");
  const packageDetails = [
    ...rawTitle.matchAll(
      /\(((?:개인|입문|그룹|피팅)\s*\d+회(?:\s*\+\s*(?:개인|입문|그룹|피팅)\s*\d+회)*)\)/g,
    ),
  ].map((match) => match[1]);
  const dayLabel = daysKnown ? baseDays.join("·") : "요일 확인 필요";
  const timeLabel = timeKnown
    ? `${rawTimeMatch![1]}:${rawTimeMatch![2]}–${rawTimeMatch![3]}:${rawTimeMatch![4]}`
    : "시간 확인 필요";
  return {
    rawTitle,
    ...sport,
    displayTitle: `[${dayLabel}] ${sport.displaySport} (${timeLabel})`,
    displayTags,
    instructors,
    additionalTypes: [...new Set(additionalTypes)],
    packageDetails,
    timeConflicts,
    needsReview: !daysKnown || !timeKnown || sport.sportNeedsReview || timeConflicts.length > 0,
  };
}
