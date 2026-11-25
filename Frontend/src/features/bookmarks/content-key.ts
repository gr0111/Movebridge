export const courseKeyPrefix = "course:institution:";
const institutionVideoPrefix = "video:institution:";
const youtubeVideoPrefix = "video:youtube:";

type VideoIdentity = { source: "institution"; id: number } | { source: "youtube"; id: string };

export function videoContentKey(video: VideoIdentity) {
  if (video.source === "institution")
    return Number.isSafeInteger(video.id) && video.id >= 0
      ? `${institutionVideoPrefix}${video.id}`
      : null;
  return /^MB-C[0-9]+$/.test(video.id) ? `${youtubeVideoPrefix}${video.id}` : null;
}

export function isVideoContentKey(key: string) {
  if (key.startsWith(institutionVideoPrefix))
    return (
      videoContentKey({
        source: "institution",
        id: Number(key.slice(institutionVideoPrefix.length)),
      }) === key
    );
  return (
    key.startsWith(youtubeVideoPrefix) &&
    videoContentKey({ source: "youtube", id: key.slice(youtubeVideoPrefix.length) }) === key
  );
}

export function bookmarkKind(key: string) {
  if (key.startsWith(courseKeyPrefix)) return "course";
  if (key.startsWith(institutionVideoPrefix) || key.startsWith(youtubeVideoPrefix)) return "video";
  return null;
}

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
  return { ids, unavailable };
}

export function matchBookmarks(
  keys: readonly string[],
  knownIds: ReadonlySet<number>,
  knownVideoKeys: ReadonlySet<string>,
) {
  const { ids, unavailable } = matchCourseBookmarks(keys, knownIds);
  const videoKeys = new Set<string>();
  for (const key of keys) {
    if (bookmarkKind(key) !== "video") continue;
    if (knownVideoKeys.has(key)) videoKeys.add(key);
    else unavailable.add(key);
  }
  return { ids, videoKeys, unavailable };
}
