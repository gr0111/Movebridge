export const courseKeyPrefix = "course:institution:";

export function courseContentKey(id: number) {
  if (!Number.isSafeInteger(id) || id < 0) return null;
  return `${courseKeyPrefix}${id}`;
}

export function courseIdForKey(key: string) {
  if (!key.startsWith(courseKeyPrefix)) return null;
  const id = Number(key.slice(courseKeyPrefix.length));
  return courseContentKey(id) === key ? id : null;
}

export function matchCourseBookmarks(keys: readonly string[], knownIds: ReadonlySet<number>) {
  const ids = new Set<number>();
  const unavailable = new Set<string>();
  for (const key of keys) {
    if (!key.startsWith(courseKeyPrefix)) continue;
    const id = courseIdForKey(key);
    if (id !== null && knownIds.has(id)) ids.add(id);
    else unavailable.add(key);
  }
  return { ids, unavailableCount: unavailable.size };
}
