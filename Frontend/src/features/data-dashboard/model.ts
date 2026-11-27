export const classificationStatuses = [
  "근거 확인",
  "추정",
  "분류 확인 필요",
  "과거 신규 원본 종목 검토",
] as const;
type ClassificationStatus = (typeof classificationStatuses)[number];

/** Column order follows project_course in Frontend/scripts/build-dashboard-data.py. */
export type CourseAuditRow = readonly [
  id: string,
  month: string,
  year: number,
  originalSport: string,
  field: string,
  sport: string | null,
  status: ClassificationStatus,
  evidence: string,
  historicalNovel: boolean,
  inService: boolean,
  searchable: boolean,
  operation: string,
  endStatus: string,
];

export const scopes = {
  full: "전체 공개 강좌 기록",
  "2026": "2026년 공개 강좌 기록",
  before_2026: "2026년 이전 공개 강좌 기록",
  search: "일반 강좌 검색 대상",
} as const;
type Scope = keyof typeof scopes;

export type AuditFilters = {
  scope: Scope;
  year: string;
  field: string;
  sport: string;
  status: string;
};
export const emptyFilters: AuditFilters = {
  scope: "full",
  year: "",
  field: "",
  sport: "",
  status: "",
};
export const unknownSport = "세부 종목 미확인";

export function auditFieldOptions(rows: readonly CourseAuditRow[]) {
  return [...new Set(rows.map(([, , , , field]) => field))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

export function auditSportOptions(rows: readonly CourseAuditRow[], field: string) {
  const sports = rows.flatMap(([, , , , rowField, sport]) =>
    !field || rowField === field ? [sport ?? unknownSport] : [],
  );
  return [...new Set(sports)].sort((a, b) => a.localeCompare(b, "ko"));
}

export function filterAudit(rows: readonly CourseAuditRow[], filters: AuditFilters) {
  const scopeRows = rows.filter(([, , , , , , , , , inService, searchable]) => {
    switch (filters.scope) {
      case "full":
        return true;
      case "2026":
        return inService;
      case "before_2026":
        return !inService;
      case "search":
        return searchable;
    }
  });
  const matches = scopeRows.filter(
    ([, , year, , field, sport, status]) =>
      (!filters.year || String(year) === filters.year) &&
      (!filters.field || field === filters.field) &&
      (!filters.sport || (sport ?? unknownSport) === filters.sport) &&
      (!filters.status || status === filters.status),
  );

  const statuses = Object.fromEntries(classificationStatuses.map((status) => [status, 0]));
  const bySport = new Map<string, { field: string; sport: string; count: number }>();
  for (const [, , , , field, sport, status] of matches) {
    statuses[status]++;
    const label = sport ?? unknownSport;
    const key = JSON.stringify([field, label]);
    const group = bySport.get(key) ?? { field, sport: label, count: 0 };
    group.count++;
    bySport.set(key, group);
  }
  return {
    scopeCount: scopeRows.length,
    matches,
    statuses,
    sports: [...bySport.values()].sort(
      (a, b) => b.count - a.count || a.sport.localeCompare(b.sport, "ko"),
    ),
  };
}

type Counts = Record<string, number>;

export function yearlySports(year: {
  denominator: number;
  confirmed_detail: Counts;
  inferred_detail: Counts;
}) {
  const names = new Set([
    ...Object.keys(year.confirmed_detail),
    ...Object.keys(year.inferred_detail),
  ]);
  const sports = [...names]
    .map((name) => ({
      label: name,
      count: (year.confirmed_detail[name] ?? 0) + (year.inferred_detail[name] ?? 0),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));
  const unconfirmed = year.denominator - sports.reduce((sum, row) => sum + row.count, 0);
  if (unconfirmed) sports.push({ label: unknownSport, count: unconfirmed });
  return sports;
}

const numbers = new Intl.NumberFormat("ko-KR");
const percentages = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const number = (value: number) => numbers.format(value);
export const percent = (count: number, denominator: number) =>
  denominator ? `${percentages.format((100 * count) / denominator)}%` : "—";
