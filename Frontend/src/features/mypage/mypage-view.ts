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

export function weeklyPreview<T extends { days: number[]; start: number }>(
  courses: readonly T[],
  dayLabels: readonly string[],
) {
  return dayLabels.map((day, index) => ({
    day,
    courses: courses
      .filter((course) => course.days.includes(index))
      .sort((a, b) => a.start - b.start),
  }));
}
