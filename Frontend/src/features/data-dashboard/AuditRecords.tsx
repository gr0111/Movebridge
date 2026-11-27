import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import courseRecordsUrl from "./generated/course-records.json?url";
import DashboardTable from "./DashboardTable";
import {
  auditFieldOptions,
  auditSportOptions,
  classificationStatuses,
  emptyFilters,
  filterAudit,
  number,
  percent,
  scopes,
  unknownSport,
} from "./model";
import type { AuditFilters, CourseAuditRow } from "./model";

const pageSize = 25;

export default function AuditRecords({ total }: { total: number }) {
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<CourseAuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    fetch(courseRecordsUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload) || payload.length !== total)
          throw new Error("Unexpected course records");
        if (!controller.signal.aborted) setRows(payload as CourseAuditRow[]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt, total]);

  const load = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  if (rows) return <RecordExplorer rows={rows} />;
  if (failed)
    return (
      <div className="compact-empty">
        <p role="alert">분류 근거 데이터를 불러오지 못했어요.</p>
        <button type="button" className="secondary-button" onClick={load}>
          다시 불러오기
        </button>
      </div>
    );
  if (attempt)
    return (
      <p className="compact-empty" role="status">
        분류 근거 데이터를 불러오는 중이에요.
      </p>
    );
  return (
    <button type="button" className="secondary-button" onClick={load}>
      분류 근거 조회 시작
    </button>
  );
}

function RecordExplorer({ rows }: { rows: CourseAuditRow[] }) {
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const scopeSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => scopeSelect.current?.focus({ preventScroll: true }), []);
  const years = [...new Set(rows.map(([, , year]) => year))].sort((a, b) => b - a);
  const { matches, statuses, sports, scopeCount } = filterAudit(rows, filters);
  const change = (name: keyof AuditFilters) => (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilters((previous) => {
      const next = { ...previous, [name]: value };
      if (
        name === "field" &&
        next.sport &&
        !auditSportOptions(rows, next.field).includes(next.sport)
      )
        return { ...next, sport: "" };
      return next;
    });
    setPage(0);
  };
  const pageCount = Math.ceil(matches.length / pageSize);
  const start = page * pageSize;

  return (
    <div className="dashboard-stack">
      <div className="dashboard-filters" aria-label="분류 근거 검색 조건">
        <label htmlFor="audit-scope">
          분석 범위
          <select
            id="audit-scope"
            ref={scopeSelect}
            value={filters.scope}
            onChange={change("scope")}
          >
            {Object.entries(scopes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-year">
          수강월 연도
          <select id="audit-year" value={filters.year} onChange={change("year")}>
            <option value="">전체 연도</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-field">
          상위 운동 분야
          <select id="audit-field" value={filters.field} onChange={change("field")}>
            <option value="">전체 분야</option>
            {auditFieldOptions(rows).map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-sport">
          표준 세부 종목
          <select id="audit-sport" value={filters.sport} onChange={change("sport")}>
            <option value="">전체 종목</option>
            {auditSportOptions(rows, filters.field).map((sport) => (
              <option key={sport}>{sport}</option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-status">
          분류 상태
          <select id="audit-status" value={filters.status} onChange={change("status")}>
            <option value="">전체 상태</option>
            {classificationStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="dashboard-controls">
        <p role="status">
          <strong>조건 일치 {number(matches.length)}건</strong> / 범위 전체 {number(scopeCount)}건
          {scopeCount > 0 && ` · 범위 대비 ${percent(matches.length, scopeCount)}`}
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setFilters(emptyFilters);
            setPage(0);
          }}
        >
          분석 필터 초기화
        </button>
      </div>
      <p>상태와 세부 종목 구성비의 분모는 조건에 일치한 {number(matches.length)}건입니다.</p>
      <ul className="dashboard-statuses" aria-label="필터 적용 후 분류 상태">
        {classificationStatuses.map((status) => (
          <li key={status}>
            {status} <strong>{number(statuses[status])}건</strong> ·{" "}
            {percent(statuses[status], matches.length)}
          </li>
        ))}
      </ul>
      {matches.length ? (
        <>
          <details>
            <summary>조건에 맞는 세부 종목 구성 보기</summary>
            <DashboardTable
              id="filtered-sports"
              caption={`세부 종목 구성 · 분모 ${number(matches.length)}건`}
              headings={["상위 분야", "세부 종목", "기록 수 (건)", "구성비"]}
            >
              {sports.map(({ field, sport, count }) => (
                <tr key={JSON.stringify([field, sport])}>
                  <td>{field}</td>
                  <th scope="row">{sport}</th>
                  <td>{number(count)}</td>
                  <td>{percent(count, matches.length)}</td>
                </tr>
              ))}
            </DashboardTable>
          </details>
          <DashboardTable
            id="audit-evidence"
            caption={`분류 근거 · 일치 ${number(matches.length)}건 중 ${number(start + 1)}–${number(Math.min(start + pageSize, matches.length))}번째 기록`}
            headings={[
              "원본 일련번호",
              "수강월",
              "원본 종목",
              "상위 분야 / 세부 종목",
              "상태 / 근거",
              "조회 범위 / 기록 상태",
            ]}
          >
            {matches.slice(start, start + pageSize).map((row) => (
              <EvidenceRow key={row[0]} row={row} />
            ))}
          </DashboardTable>
          {pageCount > 1 && (
            <nav className="dashboard-controls" aria-label="분류 근거 표 페이지">
              <button
                type="button"
                className="secondary-button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                이전 기록
              </button>
              <span role="status">
                {page + 1} / {pageCount} 페이지
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={page + 1 === pageCount}
                onClick={() => setPage(page + 1)}
              >
                다음 기록
              </button>
            </nav>
          )}
        </>
      ) : (
        <p className="compact-empty" role="status">
          조건에 일치하는 공개 강좌 기록이 없어요.
        </p>
      )}
    </div>
  );
}

function EvidenceRow({ row }: { row: CourseAuditRow }) {
  const [
    id,
    month,
    year,
    originalSport,
    field,
    sport,
    status,
    evidence,
    historicalNovel,
    inService,
    searchable,
    operation,
    endStatus,
  ] = row;
  return (
    <tr>
      <th scope="row">{id}</th>
      <td>
        {month}
        {year === 1990 && <small>수강월 연도 의미 확인 필요</small>}
      </td>
      <td>
        {originalSport || "미기재"}
        {historicalNovel && <small>과거 전용 원본 종목</small>}
      </td>
      <td>
        {field}
        <small>{sport ?? unknownSport}</small>
      </td>
      <td>
        <strong>{status}</strong>
        <small>{evidence}</small>
      </td>
      <td>
        {searchable
          ? "일반 검색 대상"
          : inService
            ? "2026년 기록 · 기본 검색 제외"
            : "과거 분석 전용"}
        <small>{operation}</small>
        <small>{endStatus}</small>
      </td>
    </tr>
  );
}
