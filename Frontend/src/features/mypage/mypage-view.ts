import type { Course } from "../../data/search.ts";
import { scheduleEntries, weekOf } from "../workout-planner/planner-model.ts";

export function readMyPageLocation(url: URL) {
  return url.searchParams.get("view") === "mypage";
}

export function withMyPageLocation(current: URL, show: boolean) {
  const url = new URL(current);
  if (show) url.searchParams.set("view", "mypage");
  else if (readMyPageLocation(url)) url.searchParams.delete("view");
  return url;
}

export function myPageAccess(pending: boolean, owner: string | null) {
  return pending ? "loading" : owner ? "member" : "guest";
}

export function weeklyPreview(
  courses: readonly Course[],
  dayLabels: readonly string[],
  dates = weekOf(),
) {
  const entries = scheduleEntries(courses, [], dates);
  return dayLabels.map((day, index) => ({
    day,
    courses: entries.flatMap((entry) =>
      entry.kind === "course" && entry.day === index ? [entry.source] : [],
    ),
  }));
}
