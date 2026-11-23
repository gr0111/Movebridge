export const COURSE_PAGE_SIZE = 9;
export const COURSE_LOAD_MORE_SIZE = 21;
export const visibleCourseRecords = <T>(records: T[], limit: number) => records.slice(0, limit);
