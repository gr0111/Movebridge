export const sportIconKeys = [
  "billiards",
  "aerobics",
  "latin",
  "ballroom",
  "line-dance",
  "horse",
  "badminton",
  "table-tennis",
  "tennis",
  "pilates",
  "basketball",
  "golf",
  "kendo",
  "gym",
  "yoga",
  "posture",
  "body-slim",
  "strength",
  "cycling",
  "zumba",
  "dance-sport",
  "swimming",
  "activity",
] as const;
export type SportIconKey = (typeof sportIconKeys)[number];

const sportIcons: Record<string, SportIconKey> = {
  당구: "billiards",
  댄스로빅: "aerobics",
  라틴: "latin",
  모던: "ballroom",
  라인댄스: "line-dance",
  실내승마: "horse",
  승마: "horse",
  배드민턴: "badminton",
  탁구: "table-tennis",
  테니스: "tennis",
  필라테스: "pilates",
  농구: "basketball",
  골프: "golf",
  검도: "kendo",
  헬스: "gym",
  요가: "yoga",
  SNPE: "posture",
  바디슬림: "body-slim",
  "바디 트레이닝": "strength",
  로드사이클: "cycling",
  줌바댄스: "zumba",
  댄스스포츠: "dance-sport",
  수영: "swimming",
};
export const courseSportAliases: Readonly<Record<string, string>> = {
  "배드민턴 단기속성": "배드민턴",
  탁구단기속성: "탁구",
  실내승마교실: "실내승마",
};

export function danceSportFromTitle(title: string) {
  return title.trim().match(/^(?:\d{2,4}\.\s*)?(모던|라틴)(?!\p{L})/u)?.[1];
}

/** User-approved contextual interpretation, not an officially verified abbreviation. */
export function inferHolidaySport(course: { sport: string; title: string }) {
  if (course.sport.trim() !== "방학특강" || !/(?:^|[\s.])방특\s+배민(?=$|[\s(])/.test(course.title))
    return null;
  const conflictingSport = Object.keys(sportIcons).some(
    (sport) => sport !== "배드민턴" && course.title.includes(sport),
  );
  return conflictingSport
    ? null
    : {
        sport: "배드민턴",
        evidence:
          "원본 종목이 ‘방학특강’이고 원본 강좌명에 ‘방특 배민’ 표기가 있어 배드민턴으로 추정했습니다. 공식 약어 해석은 확인되지 않았습니다.",
      };
}

/** Shared presentation resolution; original fields are never rewritten. */
export function resolveCourseSport(course: { sport: string; title: string }) {
  const rawSport = course.sport.trim();
  const inference = inferHolidaySport(course);
  let displaySport = courseSportAliases[rawSport] || rawSport;
  if (rawSport === "댄스스포츠") {
    const dance = danceSportFromTitle(course.title);
    if (dance) displaySport = dance;
  } else if (rawSport === "방학특강" || !rawSport || rawSport === "미기재") {
    // Full names take precedence; only the approved holiday phrase is inferred.
    const namedSport = Object.keys(sportIcons)
      .sort((a, b) => b.length - a.length)
      .find((sport) => course.title.replace(/헬스\s*등록\s*필수/g, "").includes(sport));
    if (namedSport) displaySport = namedSport;
    else if (inference) displaySport = inference.sport;
  }
  if (!displaySport || displaySport === "미기재") displaySport = "종목 미기재";
  const unresolvedHoliday = rawSport === "방학특강" && displaySport === rawSport;
  if (unresolvedHoliday) displaySport = "종목 확인 필요";
  return {
    displaySport,
    pictogramKey: sportIcons[displaySport] || ("activity" as SportIconKey),
    sportNeedsReview: !sportIcons[displaySport] || Boolean(inference),
    sportResolutionEvidence: inference?.evidence || null,
    sportResolutionStatus: inference
      ? ("inferred" as const)
      : displaySport === "종목 미기재" || unresolvedHoliday
        ? ("unresolved" as const)
        : !rawSport ||
            rawSport === "미기재" ||
            rawSport === "방학특강" ||
            (rawSport === "댄스스포츠" && displaySport !== rawSport)
          ? ("title" as const)
          : ("original" as const),
  };
}
