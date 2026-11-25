import { resolveCourseSport } from "./course-sport.ts";

/** Conservative eligibility only: access/facility wording alone is not proof of a non-course. */
export function assessCourseEligibility(course: { sport: string; title: string }) {
  const resolution = resolveCourseSport(course);
  const missingSport = !course.sport.trim() || course.sport.trim() === "미기재";
  const searchableAsCourse = !(missingSport && resolution.sportResolutionStatus === "unresolved");
  return {
    searchableAsCourse,
    exclusionReason: searchableAsCourse
      ? null
      : "원본 종목이 미기재이고 강좌명에서도 실제 운동 종목을 확인할 수 없음",
    resolvedSport:
      resolution.sportResolutionStatus === "unresolved" ? null : resolution.displaySport,
    sportResolutionStatus: resolution.sportResolutionStatus,
  };
}
