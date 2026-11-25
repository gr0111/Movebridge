import { courseSportAliases, inferHolidaySport } from "./course-sport.ts";
import { courses } from "./search.ts";
import type { Course } from "./search.ts";
import { rawVideos } from "./sample-data.ts";

const analysisFields = [
  "유연성·스트레칭",
  "근력·체력 향상",
  "리듬·댄스",
  "수영·수중운동",
  "유산소·러닝·사이클",
  "라켓 스포츠",
  "구기 스포츠",
  "무도·격투 스포츠",
  "골프",
  "당구",
  "승마",
  "기타 운동",
  "분류 확인 필요",
  "운동 외 콘텐츠",
] as const;

type AnalysisField = (typeof analysisFields)[number];
type Classification = {
  field: AnalysisField;
  sport: string | null;
  evidence: string;
  inferred?: true;
};
const unknown = (evidence: string): Classification => ({
  field: "분류 확인 필요",
  sport: null,
  evidence,
});
const nonSport = (evidence: string): Classification => ({
  field: "운동 외 콘텐츠",
  sport: null,
  evidence,
});
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

// Use exact source-field values. Only explicitly attested compounds are aliases.
const courseGroups: { field: AnalysisField; sports: string[] }[] = [
  { field: "유연성·스트레칭", sports: ["요가", "필라테스", "스트레칭", "SNPE"] },
  { field: "근력·체력 향상", sports: ["헬스", "TRX", "근력운동"] },
  {
    field: "리듬·댄스",
    sports: ["댄스스포츠", "라인댄스", "줌바댄스", "댄스로빅", "모던", "라틴"],
  },
  { field: "수영·수중운동", sports: ["수영", "아쿠아로빅"] },
  {
    field: "유산소·러닝·사이클",
    sports: ["로드사이클", "사이클", "스피닝", "러닝", "워킹", "트램폴린"],
  },
  { field: "라켓 스포츠", sports: ["테니스", "배드민턴", "탁구"] },
  { field: "구기 스포츠", sports: ["농구"] },
  { field: "무도·격투 스포츠", sports: ["검도"] },
  { field: "골프", sports: ["골프"] },
  { field: "당구", sports: ["당구"] },
  { field: "승마", sports: ["승마", "실내승마"] },
];
const courseDisciplines = new Map(
  courseGroups.flatMap(({ field, sports }) =>
    sports.map((sport) => [normalize(sport), { field, sport }] as const),
  ),
);
// A full term must be delimited. This avoids e.g. 검도장, 요가매트 and venue names.
const titleTerms = [...courseDisciplines.values()]
  .filter(({ sport }) => sport !== "모던" && sport !== "라틴")
  .map((discipline) => ({
    ...discipline,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${discipline.sport}(?![\\p{L}\\p{N}])`, "iu"),
  }));

export function classifyAnalysisCourse(course: Pick<Course, "sport" | "title">): Classification {
  const rawSport = normalize(course.sport);
  const title = course.title.replace(/헬스\s*등록\s*필수/g, "");
  const named = courseDisciplines.get(normalize(courseSportAliases[rawSport] ?? rawSport));
  if (named) {
    const dance =
      named.sport === "댄스스포츠"
        ? title.trim().match(/^(?:\d{2,4}\.\s*)?(모던|라틴)(?!\p{L})/u)?.[1]
        : undefined;
    return {
      ...named,
      sport: dance ?? named.sport,
      evidence: `원본 종목 ‘${course.sport}’${dance ? ` 및 강좌명 ‘${dance}’ 표기` : ""}`,
    };
  }

  const matches = titleTerms.filter(({ pattern }) => pattern.test(title));
  if (matches.length === 1) {
    const { field, sport } = matches[0];
    return { field, sport, evidence: `원본 강좌명에 명시된 ‘${sport}’` };
  }
  if (matches.length > 1) {
    return unknown(`원본 강좌명에 여러 종목 표기: ${matches.map(({ sport }) => sport).join("·")}`);
  }

  const inferred = inferHolidaySport(course);
  if (inferred)
    return {
      field: "라켓 스포츠",
      sport: inferred.sport,
      evidence: inferred.evidence,
      inferred: true,
    };
  if (rawSport === "바디슬림" || rawSport === "바디 트레이닝") {
    return unknown("프로그램명만 제공되며 ‘헬스등록필수’는 등록 조건입니다.");
  }
  return unknown("원본 종목과 강좌명에서 구체적인 운동을 확인할 수 없습니다.");
}

type InstitutionMetadata = Pick<
  (typeof rawVideos)[number],
  "제목" | "관심분야" | "콘텐츠유형" | "분류근거"
>;

// Keywords are restricted to the existing documented topic. The topic can be
// broader than the title evidence, so a known field doesn't imply a known sport.
const institutionSports: Partial<Record<AnalysisField, readonly [string, RegExp][]>> = {
  유연성·스트레칭: [["필라테스", /^(?:기구)?필라테스$/]],
  "근력·체력 향상": [
    ["근력운동", /(?:^|\s)근력운동$/],
    ["헬스", /^헬스(?:PT|테라피)?$/i],
    ["TRX", /^TRX$/i],
  ],
  리듬·댄스: [
    ["라인댄스", /^라인댄스(?=$|[\s(])|\bLine Dance$/i],
    ["발레핏", /^발레핏$/],
    ["피규어로빅스", /^피규어로빅스$/],
    ["벨리댄스", /^벨리댄스$/],
  ],
  수영·수중운동: [
    [
      "수영",
      /(?:^(?:접영|평영|배영|자유형)(?=$|\s)|^(?:생존)?수영$|^(?:올림픽수영장 )?올팍하면 수영이지 제?\d탄$)/,
    ],
    ["아쿠아로빅", /^아쿠아로빅$/],
    ["아티스틱 스위밍(싱크로)", /^올림픽싱크로교실$/],
    ["프리다이빙", /^프리다이빙 영상$/],
  ],
  유산소·러닝·사이클: [
    ["스피닝", /^스피닝(?:바이크)?$/],
    ["러닝", /(?:^|\s)(?:올림픽공원 )?러닝크루(?=$|\s)/],
    ["러닝·워킹", /(?:^|\s)러닝&워킹(?=$|\s)/],
    ["점핑트램폴린", /(?:^|[\s【])점핑트램폴린(?=$|[\s-])/],
  ],
};

export function classifyAnalysisVideo(row: InstitutionMetadata): Classification {
  if (row.관심분야 === "운동 외 콘텐츠") return nonSport(`첨부 분류근거 ‘${row.분류근거}’`);
  if (row.콘텐츠유형 === "접수·신청 안내 후보" && /접수\s*시작/.test(row.제목)) {
    return nonSport("원본 제목의 접수 시작 표기와 첨부 콘텐츠유형의 접수·신청 안내 후보 표기");
  }
  if (/^WE SUPPORT K-POP, OLYMPICPARK$/i.test(row.제목)) {
    return nonSport("원본 제목에 K-POP 응원 문구가 있으며 운동 종목 표기는 없습니다.");
  }

  const field = analysisFields.find((candidate) => candidate === row.관심분야);
  if (!field || field === "분류 확인 필요") {
    return unknown("첨부 관심분야가 ‘검토 필요’이며 원본 제목만으로 종목을 확정하기 어렵습니다.");
  }
  const matches = (institutionSports[field] ?? []).filter(([, pattern]) => pattern.test(row.제목));
  const sport = matches.length === 1 ? matches[0][0] : null;
  return {
    field,
    sport,
    evidence: sport
      ? `원본 영상 제목의 ‘${sport}’ 관련 표기와 첨부 관심분야 ‘${row.관심분야}’`
      : `첨부 관심분야 ‘${row.관심분야}’. 제목의 세부 종목은 확인 필요`,
  };
}

export const analyzedCourses = new Map(
  courses.map((course) => [course.id, classifyAnalysisCourse(course)]),
);
export const analyzedInstitutionVideos = new Map(
  rawVideos.map((video) => [Number(video.순번), classifyAnalysisVideo(video)]),
);

export const discoveryDistribution = analysisFields.map((field) => {
  const offline = [...analyzedCourses.values()].filter((item) => item.field === field);
  const online = [...analyzedInstitutionVideos.values()].filter((item) => item.field === field);
  const sportOf = (item: Classification) => item.sport ?? "세부 종목 확인 필요";
  const sports = [...new Set([...offline, ...online].map(sportOf))];
  const detail = sports
    .map((sport) => ({
      sport,
      offline: offline.filter((item) => sportOf(item) === sport).length,
      online: online.filter((item) => sportOf(item) === sport).length,
    }))
    .sort(
      (a, b) => b.offline + b.online - a.offline - a.online || a.sport.localeCompare(b.sport, "ko"),
    );
  return { field, offline: offline.length, online: online.length, detail };
});
