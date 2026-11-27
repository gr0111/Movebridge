import type { Course } from "./search.ts";

export const courseAvailability = "공개 강좌 기록 · 현재 운영·모집 미확인";
export const sourcePauseTag = "원본에 ‘일시중지’ 표기 · 현재 상태는 미확인";
const koreaCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function koreaDate(now = new Date()) {
  const parts = koreaCalendar.formatToParts(now);
  const part = (name: "year" | "month" | "day") => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

type StatusInput = Pick<Course, "title" | "sport" | "audience" | "rawTime" | "endDate">;
const rawTimePattern = /^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/;
const clockPattern = "(?:\\d{1,2}:\\d{2}|\\d{4}|\\d{1,2})";
const ranges = new RegExp(
  `(?<!\\d)(${clockPattern})\\s*[-~–]\\s*(${clockPattern})(?:시)?(?!\\d)`,
  "g",
);

function clockValue(value: string) {
  const clean = value.replace(/시$/, "").trim();
  const [hour, minute] = clean.includes(":")
    ? clean.split(":").map(Number)
    : clean.length === 4
      ? [Number(clean.slice(0, 2)), Number(clean.slice(2))]
      : [Number(clean), 0];
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}

function timesFromRecord({ title, rawTime }: StatusInput) {
  const match = rawTime.match(rawTimePattern);
  const start = match ? clockValue(`${match[1]}:${match[2]}`) : null;
  const end = match ? clockValue(`${match[3]}:${match[4]}`) : null;
  const timeKnown = start !== null && end !== null && end > start;
  const titleRanges = [...title.matchAll(ranges)];
  const timeConflicts = titleRanges
    .filter((item) => !timeKnown || clockValue(item[1]) !== start || clockValue(item[2]) !== end)
    .map((item) => item[0]);
  if (!titleRanges.length) {
    for (const item of title.matchAll(/(?<![\d:])(?:\d{1,2}:\d{2}|\d{1,2}시)(?![\d:])/g))
      if (!timeKnown || clockValue(item[0]) !== start) timeConflicts.push(item[0]);
  }
  return {
    timeConflicts,
    timeLabel: match && timeKnown ? `${match[1]}:${match[2]}–${match[3]}:${match[4]}` : null,
  };
}

function programTypes({ title, sport, audience }: StatusInput) {
  const fields = [title, sport, audience];
  const explicitStaff = /(?:^|[^\p{L}])임직원\s*(?:전용|한정|만)(?=$|[^\p{L}])/u;
  const employeeOnly =
    fields.some((field) => explicitStaff.test(field)) ||
    audience.trim() === "임직원" ||
    sport.trim() === "임직원" ||
    /^(?:\d{2,4}\.\s*)?임직원(?=[_/-])/.test(title.trim());
  const personalPractice = fields.some((field) => /개인\s*자유\s*운동/.test(field));
  const freeUse = fields.some((field) => /자유\s*이용/.test(field));
  const tags = [
    ...(employeeOnly ? ["임직원 전용"] : []),
    ...(personalPractice ? ["개인 자유운동"] : []),
    ...(freeUse ? ["자유이용"] : []),
  ];
  return { employeeOnly, personalPractice, freeUse, tags };
}

export function getCourseStatus(course: StatusInput, today = koreaDate()) {
  const pausedInSource = course.title.includes("일시중지");
  const { timeConflicts, timeLabel } = timesFromRecord(course);
  const program = programTypes(course);
  const specialEnd = course.endDate === "9999-12-31";
  const candidate = new Date(`${course.endDate}T00:00:00Z`);
  const recordEndDate =
    !specialEnd &&
    /^\d{4}-\d{2}-\d{2}$/.test(course.endDate) &&
    Number.isFinite(candidate.getTime()) &&
    candidate.toISOString().slice(0, 10) === course.endDate
      ? course.endDate
      : null;
  const endedInRecord = recordEndDate !== null && recordEndDate < today;

  const undatedHoldReasons = [
    ...(pausedInSource ? ["원본에 일시중지 표기"] : []),
    ...(timeConflicts.length ? ["제목·수강시간 불일치"] : []),
    ...(!timeLabel && !timeConflicts.length ? ["원본 수강시간 확인 필요"] : []),
  ];

  return {
    availability: courseAvailability,
    pausedInSource,
    timeConflicts,
    timeLabel,
    program,
    specialEnd,
    recordEndDate,
    endedInRecord,
    endLabel: specialEnd
      ? "종료일 확인 불가 · 원본 특수 표기 9999-12-31"
      : (recordEndDate ?? "원본 종료일 확인 불가"),
    canRecommend:
      !pausedInSource && !program.employeeOnly && !program.freeUse && !program.personalPractice,
    scheduleHoldReasons(date = today) {
      return recordEndDate !== null && recordEndDate < date
        ? [...undatedHoldReasons, "기록상 종료일 경과"]
        : undatedHoldReasons;
    },
  };
}
