import { getCourseStatus, koreaDate } from "../../data/course-status.ts";
import type { Course } from "../../data/search.ts";

export { koreaDate } from "../../data/course-status.ts";

export type WorkoutDraft = {
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  note: string;
};
export type WorkoutFields = Omit<WorkoutDraft, "note"> & { note: string | null };
export type WorkoutPlan = WorkoutFields & { id: string };
export type WorkoutCompletion = { plan_id: string; performed_on: string };

export const workoutTitleLimit = 80;
export const workoutNoteLimit = 500;
const minuteTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateWorkoutDraft(draft: WorkoutDraft) {
  const title = draft.title.trim();
  const note = draft.note.trim() || null;
  if (!title || [...title].length > workoutTitleLimit)
    return { error: `운동명은 1~${workoutTitleLimit}자로 입력해 주세요.` } as const;
  if (!Number.isInteger(draft.day_of_week) || draft.day_of_week < 0 || draft.day_of_week > 6)
    return { error: "요일을 선택해 주세요." } as const;
  if (!minuteTime.test(draft.start_time) || !minuteTime.test(draft.end_time))
    return { error: "시작시간과 종료시간을 입력해 주세요." } as const;
  if (draft.start_time >= draft.end_time)
    return { error: "같은 날의 시작시간보다 늦은 종료시간을 선택해 주세요." } as const;
  if (note && [...note].length > workoutNoteLimit)
    return { error: `메모는 ${workoutNoteLimit}자까지 입력할 수 있어요.` } as const;
  const fields: WorkoutFields = { ...draft, title, note };
  return { fields } as const;
}

const dateString = (date: Date) => date.toISOString().slice(0, 10);

export function dateWeekday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || dateString(date) !== value) return null;
  return (date.getUTCDay() + 6) % 7;
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
}

export function weekOf(value = koreaDate()) {
  const weekday = dateWeekday(value)!;
  return Array.from({ length: 7 }, (_, index) => addDays(value, index - weekday));
}

export const completionKey = (planId: string, date: string) => `${planId}:${date}`;
export const koreaDisplayDate = (value: string) =>
  `${Number(value.slice(5, 7))}월 ${Number(value.slice(8))}일`;

export function workoutSummary(
  plans: readonly WorkoutPlan[],
  completions: readonly WorkoutCompletion[],
  now = new Date(),
) {
  const dates = weekOf(koreaDate(now));
  const keys = new Set(
    completions.map(({ plan_id, performed_on }) => completionKey(plan_id, performed_on)),
  );
  const planned = plans.length;
  const completed = plans.filter((plan) =>
    keys.has(completionKey(plan.id, dates[plan.day_of_week])),
  ).length;
  const planNames = new Map(plans.map(({ id, title }) => [id, title]));
  const recent = completions
    .filter(({ plan_id }) => planNames.has(plan_id))
    .sort(
      (a, b) => b.performed_on.localeCompare(a.performed_on) || a.plan_id.localeCompare(b.plan_id),
    )
    .slice(0, 5)
    .map((completion) => ({ ...completion, title: planNames.get(completion.plan_id)! }));
  return {
    planned,
    completed,
    rate: planned ? Math.round((100 * completed) / planned) : 0,
    recent,
  };
}

type Timed = { key: string; title: string; day: number; start: number; end: number };
export type ScheduleEntry = Timed &
  ({ kind: "course"; source: Course } | { kind: "personal"; source: WorkoutPlan });
const decimalTime = (value: string) => Number(value.slice(0, 2)) + Number(value.slice(3, 5)) / 60;

export function scheduleEntries(
  courses: readonly Course[],
  plans: readonly WorkoutPlan[],
  dates = weekOf(),
) {
  const entries: ScheduleEntry[] = [
    ...courses.flatMap((course) => {
      const status = getCourseStatus(course);
      return course.days
        .filter((day) => dates[day] && !status.scheduleHoldReasons(dates[day]).length)
        .map((day) => ({
          kind: "course" as const,
          source: course,
          key: `course:${course.id}`,
          title: course.title,
          day,
          start: course.start,
          end: course.end,
        }));
    }),
    ...plans.map((plan) => ({
      kind: "personal" as const,
      source: plan,
      key: `plan:${plan.id}`,
      title: plan.title,
      day: plan.day_of_week,
      start: decimalTime(plan.start_time),
      end: decimalTime(plan.end_time),
    })),
  ];
  return entries.sort((a, b) => a.start - b.start || a.end - b.end || a.key.localeCompare(b.key));
}

export const hourHeight = 64;
export const minimumEventHeight = 52;

export function dayLayout(entries: readonly ScheduleEntry[]) {
  const positioned: { entry: ScheduleEntry; lane: number; lanes: number }[] = [];
  let ends: number[] = [];
  let groupStart = 0;
  let latestActualEnd = -Infinity;
  let overlaps = false;
  const finishGroup = () => {
    for (let index = groupStart; index < positioned.length; index++)
      positioned[index].lanes = ends.length;
    groupStart = positioned.length;
    ends = [];
  };
  for (const entry of entries) {
    if (ends.every((end) => end <= entry.start)) finishGroup();
    const firstFree = ends.findIndex((end) => end <= entry.start);
    const lane = firstFree === -1 ? ends.length : firstFree;
    ends[lane] = Math.max(entry.end, entry.start + minimumEventHeight / hourHeight);
    positioned.push({ entry, lane, lanes: 1 });
    overlaps ||= entry.start < latestActualEnd;
    latestActualEnd = Math.max(latestActualEnd, entry.end);
  }
  finishGroup();
  return { positioned, overlaps };
}
