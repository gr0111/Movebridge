import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Icon from "../../components/Icon";
import AuditRecords from "./AuditRecords";
import DashboardTable from "./DashboardTable";
import SampleAnalysis from "./SampleAnalysis";
import overview from "./generated/overview.json";
import { number, percent, yearlySports } from "./model";
import "./dashboard.css";

const { totals, cohorts, years, coverage, beginner, novel, quality } = overview;
const yearEntries = Object.entries(years).sort(([a], [b]) => Number(a) - Number(b));
const historicalCount = cohorts.before_2026.denominator;
const videoScope = overview.institutionCandidates;
const analysisFiles =
  "https://github.com/gr0111/Movebridge/blob/8991fb87ab11384f31e1ab6df2f7ee16848c2dcf";

const contents = [
  ["data-years", "연도별 기록"],
  ["data-fields", "운동 분야 비교"],
  ["data-records", "분류 근거"],
  ["data-coverage", "영상 연계"],
  ["data-beginner", "입문 콘텐츠"],
  ["data-quality", "데이터 품질"],
  ["sample-analysis", "2026년 샘플 세부 분석"],
  ["data-sources", "데이터 출처"],
];

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={-1}
      className="chart-card dashboard-panel"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

type BarRow = { label: string; values: number[] };
function RecordBars({ rows, series }: { rows: BarRow[]; series: string[] }) {
  const max = Math.max(1, ...rows.flatMap(({ values }) => values));
  return (
    <div className="dashboard-chart" aria-hidden="true">
      <p>기록 수 (건) · 막대 기준 최대 {number(max)}건</p>
      <ul className="dashboard-bar-list">
        {rows.map(({ label, values }) => (
          <li key={label}>
            <strong>{label}</strong>
            {values.map((value, index) => (
              <div className="dashboard-bar-row" key={series[index]}>
                {series.length > 1 && <span>{series[index]}</span>}
                <span className={`distribution-track dashboard-series-${index}`}>
                  <span style={{ width: `${(100 * value) / max}%` }} />
                </span>
                <b>{number(value)}</b>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function YearAnalysis() {
  const [year, setYear] = useState<keyof typeof years>("2022");
  const yearStats = years[year];
  const sports = yearlySports(yearStats);
  const sportBars = sports.map(({ label, count }) => ({ label, values: [count] }));
  return (
    <Panel id="data-years" title="연도별 공개 강좌 기록">
      <p>
        수강월에 표시된 연도별 집계입니다. 기록 수의 변화만으로 운영 확대나 수강 수요를 판단할 수
        없습니다.
      </p>
      <div className="info-box dashboard-note">
        <Icon name="info" size={18} />
        <p>
          원본 수강월이 1990년인 기록은 {number(years["1990"].denominator)}건입니다. 이 날짜가
          뜻하는 바는 확인이 필요합니다.
        </p>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-stack">
          <h3>연도별 기록 수</h3>
          <RecordBars
            rows={yearEntries.map(([value, data]) => ({
              label: `${value}년`,
              values: [data.denominator],
            }))}
            series={["강좌"]}
          />
          <DashboardTable
            id="year-counts"
            caption={`수강월 연도별 기록 · 전체 ${number(totals.raw_courses)}건`}
            headings={["수강월 연도", "기록 수 (건)", "전체 대비"]}
          >
            {yearEntries.map(([value, data]) => (
              <tr key={value}>
                <th scope="row">{value}년</th>
                <td>{number(data.denominator)}</td>
                <td>{percent(data.denominator, totals.raw_courses)}</td>
              </tr>
            ))}
          </DashboardTable>
        </div>
        <div className="dashboard-stack">
          <div className="dashboard-controls">
            <h3>선택 연도의 세부 종목 구성</h3>
            <label className="dashboard-select" htmlFor="composition-year">
              종목 구성 연도
              <select
                id="composition-year"
                value={year}
                onChange={(event) => setYear(event.target.value as keyof typeof years)}
              >
                {yearEntries.map(([value]) => (
                  <option key={value} value={value}>
                    {value}년
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            확인 및 추정 종목을 집계합니다. 확인할 수 없는 종목은 ‘세부 종목 미확인’으로 표시합니다.
          </p>
          <RecordBars rows={sportBars} series={["기록"]} />
          <DashboardTable
            id="year-sports"
            caption={`${year}년 세부 종목 구성 · ${number(yearStats.denominator)}건`}
            headings={["세부 종목", "기록 수 (건)", "해당 연도 대비"]}
          >
            {sports.map(({ label, count }) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{number(count)}</td>
                <td>{percent(count, yearStats.denominator)}</td>
              </tr>
            ))}
          </DashboardTable>
        </div>
      </div>
    </Panel>
  );
}

const comparisons = [
  { label: "전체", cohort: cohorts.full },
  { label: "2026년", cohort: cohorts["2026"] },
  { label: "2026년 이전", cohort: cohorts.before_2026 },
];
const fieldCount = (fields: Record<string, number>, field: string) => fields[field] ?? 0;
const fieldRows = Object.keys(cohorts.full.fields).sort(
  (a, b) => fieldCount(cohorts.full.fields, b) - fieldCount(cohorts.full.fields, a),
);

function FieldComparison() {
  const allRacket = cohorts.full.fields["라켓 스포츠"];
  const recentRacket = cohorts["2026"].fields["라켓 스포츠"];
  const diff = 100 * (recentRacket / totals.service_courses - allRacket / totals.raw_courses);
  const difference = diff.toLocaleString("ko-KR", {
    signDisplay: "always",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return (
    <Panel id="data-fields" title="상위 운동 분야 비교">
      <p>
        라켓 스포츠 비중은 전체 {percent(allRacket, totals.raw_courses)}, 2026년{" "}
        {percent(recentRacket, totals.service_courses)}로{` ${difference}%p `}차이가 납니다. 전체에
        2026년 기록이 포함되므로 같은 원본 안에서 기록 구성을 비교한 수치입니다.
      </p>
      <div className="dashboard-columns">
        <RecordBars
          rows={fieldRows.map((field) => ({
            label: field,
            values: comparisons.map(({ cohort }) => fieldCount(cohort.fields, field)),
          }))}
          series={comparisons.map(({ label }) => label)}
        />
        <DashboardTable
          id="field-counts"
          caption="상위 분야별 공개 강좌 기록 수와 범위별 비중"
          headings={[
            "상위 분야",
            ...comparisons.map(({ label, cohort }) => `${label} ${number(cohort.denominator)}건`),
          ]}
        >
          {fieldRows.map((field) => (
            <tr key={field}>
              <th scope="row">{field}</th>
              {comparisons.map(({ label, cohort }) => {
                const count = fieldCount(cohort.fields, field);
                return (
                  <td key={label}>
                    {number(count)}건<small>{percent(count, cohort.denominator)}</small>
                  </td>
                );
              })}
            </tr>
          ))}
        </DashboardTable>
      </div>
      <p>
        어느 범위에든 기록이 있는 분야를 비교합니다. 개별 범위에 해당 기록이 없으면 0건으로
        표시합니다.
      </p>
    </Panel>
  );
}

const ratio = (count: number, base: number) => `${number(count)} / ${number(base)}`;

function VideoCoverage() {
  const sports = coverage.confirmed_search_sports;
  const fields = coverage.confirmed_search_fields;
  const courses = coverage.confirmed_search_records;
  const metrics = [
    [
      "같은 종목 영상 연결 (종목)",
      ratio(coverage.sport_exact_before.count, sports),
      ratio(coverage.sport_exact_after.count, sports),
    ],
    [
      "같은 분야만 연결 (종목)",
      ratio(coverage.related_field_only_before.length, sports),
      ratio(coverage.related_field_only_after.length, sports),
    ],
    [
      "연계 공백 (종목)",
      ratio(coverage.no_match_before.length, sports),
      ratio(coverage.no_positive_video_path_after.length, sports),
    ],
    [
      "영상이 있는 상위 분야 (분야)",
      ratio(coverage.institution_fields_before.length, fields),
      ratio(coverage.institution_or_external_fields_after.length, fields),
    ],
    [
      "같은 종목 영상이 있는 강좌 기록 (건)",
      ratio(coverage.sport_exact_before.course_records, courses),
      ratio(coverage.sport_exact_after.course_records, courses),
    ],
  ];
  return (
    <Panel id="data-coverage" title="강좌와 영상의 연계 현황">
      <p>
        일반 검색 대상 중 근거 확인 강좌 {number(courses)}건, 세부 종목 {sports}개, 상위 분야{" "}
        {fields}개 기준입니다.
      </p>
      <p>
        공공기관 공개 영상 {totals.institution_videos}건 중 연계 탐색 후보는 {videoScope}건입니다.
        외부 YouTube {totals.external_videos}건과 합한 영상 목록은 {totals.all_videos}건입니다.
      </p>
      <DashboardTable
        id="linkage-comparison"
        caption="기관 영상만 활용한 경우와 외부 영상 추가 후 비교"
        headings={["연계 기준과 단위", "기관만", "기관 + 외부 YouTube"]}
      >
        {metrics.map(([label, before, after]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{before}</td>
            <td>{after}</td>
          </tr>
        ))}
      </DashboardTable>
      <p>
        외부 영상으로 {coverage.newly_covered_sports.map(({ sport }) => sport).join("·")}가 새로
        연결됐습니다. 두 경로가 모두 비어 있는 종목의 강좌는{" "}
        {ratio(coverage.no_positive_video_path_after_course_records, courses)}건입니다.
      </p>
      <p>
        같은 종목은 상위 분야와 표준 세부 종목이 모두 일치하는 경우입니다. 같은 분야 대안은 상위
        분야만 일치합니다. 공식 교육과정 관계는 확인되지 않았습니다. 명칭 통합 규칙은{" "}
        {Object.entries(overview.aliases)
          .map(([from, to]) => `${from} → ${to}`)
          .join(", ")}
        입니다.
      </p>
      <details>
        <summary>19개 종목별 연계와 공백 보기</summary>
        <DashboardTable
          id="linkage-sports"
          caption={`근거 확인 ${sports}종목 · 영상 수 단위 건`}
          headings={[
            "세부 종목",
            "대상 강좌",
            "같은 종목 기관 영상",
            "같은 종목 외부 영상",
            "같은 분야 대안 (기관+외부)",
          ]}
        >
          {overview.coverageSports.map((row) => (
            <tr key={`${row.field}/${row.sport}`}>
              <th scope="row">
                {row.sport}
                <small>{row.field}</small>
              </th>
              <td>{number(row.courses)}</td>
              <td>{number(row.institution)}</td>
              <td>{number(row.external)}</td>
              <td>
                {number(row.institutionRelated + row.externalRelated)}
                {!(
                  row.institution +
                  row.external +
                  row.institutionRelated +
                  row.externalRelated
                ) && <small>연계 공백</small>}
              </td>
            </tr>
          ))}
        </DashboardTable>
      </details>
    </Panel>
  );
}

function BeginnerAnalysis() {
  const metrics: [string, string, number, number][] = [
    ["전체 강좌", "제목 표현", cohorts.full.title_intro, totals.raw_courses],
    ["2026년 강좌", "제목 표현", cohorts["2026"].title_intro, totals.service_courses],
    ["일반 검색 대상", "제목 표현", beginner.searchTitle, totals.searchable_courses],
    ["기관 영상 전체", "제목 표현", beginner.institutionTitle, totals.institution_videos],
    ["기관 영상 연계 후보", "제목 표현", beginner.institutionCandidateTitle, videoScope],
    ["외부 YouTube", "제목 표현", beginner.externalTitle, totals.external_videos],
    ["외부 YouTube", "표본 입문·기초", beginner.externalSampleIntro, totals.external_videos],
    ["외부 YouTube", "두 근거 모두", beginner.externalBoth, totals.external_videos],
    ["외부 YouTube", "표본 판단 보류", beginner.externalHeld, totals.external_videos],
  ];
  return (
    <Panel id="data-beginner" title="운동 입문을 탐색할 수 있는 자료">
      <p>
        Phase 2의 제목 기준은 입문·처음·초급·기초 및 독립 단어 Beginner입니다. 표본 추천운동경험은
        외부 영상의 일부 구간 검증값입니다.
      </p>
      <DashboardTable
        id="beginner-evidence"
        caption="제목 표현과 표본 추천운동경험 · 자료 구분별 분모"
        headings={["자료 범위", "확인 근거", "해당 / 범위 전체 (건)", "범위 대비"]}
      >
        {metrics.map(([source, basis, count, base]) => (
          <tr key={`${source}/${basis}`}>
            <th scope="row">{source}</th>
            <td>{basis}</td>
            <td>{ratio(count, base)}</td>
            <td>{percent(count, base)}</td>
          </tr>
        ))}
      </DashboardTable>
      <p>
        표본에서 판단을 보류한 영상은 경험 수준 미확인으로 집계합니다. 실제 난이도와 개인별 적합성은
        별도 확인이 필요합니다.
      </p>
    </Panel>
  );
}

function QualityAnalysis() {
  const statusRows: [string, number, number][] = [
    ["추정 분류", cohorts.full.statuses["추정"], totals.raw_courses],
    ["분류 확인 필요", cohorts.full.statuses["분류 확인 필요"], totals.raw_courses],
    ["과거 신규 원본 종목 검토", novel.records, totals.raw_courses],
    ["일시중지 표기", quality.paused, totals.service_courses],
    ["제목과 수강시간 불일치", quality.timeConflicts, totals.service_courses],
    ["특수 종료일 9999-12-31", quality.specialEnd, totals.service_courses],
    ["분석 기준일에 기록상 종료일 경과", quality.ended, totals.service_courses],
  ];
  return (
    <Panel id="data-quality" title="데이터 품질과 보완 과제">
      <DashboardTable
        id="data-quality-counts"
        caption={`원본 검토 결과 · 기준일 ${overview.asOf} KST`}
        headings={["확인 항목", "해당 / 범위 전체 (건)"]}
      >
        {statusRows.map(([label, count, base]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{ratio(count, base)}</td>
          </tr>
        ))}
      </DashboardTable>
      <p>
        과거에만 등장하는 원본 종목은 {novel.labels}종, {novel.records}건입니다. 검토 단계의 후보는
        표준 종목 집계에서 보류했습니다.
      </p>
      <ul className="dashboard-list">
        <li>스피닝바이크 {novel.examples.스피닝바이크}건 · 스피닝 후보</li>
        <li>실내축구 {novel.examples.실내축구}건 · 직접 대응 종목 미확인</li>
        <li>오카리나 {novel.examples.오카리나}건 · 제목과 원본 종목이 충돌해 보류</li>
      </ul>
      <h3>추가 개방과 품질 개선 제안</h3>
      <ol className="dashboard-list">
        <li>강좌별 현재 운영 여부</li>
        <li>모집 중 여부와 갱신 시각</li>
        <li>공식 신청 URL</li>
        <li>강좌·영상 공통 연계 식별자</li>
        <li>공식 운동 종목 분류 코드</li>
        <li>강습 난이도와 추천 운동 경험 수준</li>
        <li>영상 접근 가능 여부와 최신 검증일</li>
      </ol>
    </Panel>
  );
}

function Sources() {
  return (
    <Panel id="data-sources" title="데이터 출처와 집계 기준">
      <p>
        분석 기준일 {overview.asOf} KST. 강좌는 한국체육산업개발(주) 원본의 공개 강좌 기록 행 단위로
        집계했습니다.
      </p>
      <ul className="dashboard-list">
        <li>
          <a href="https://www.data.go.kr/data/15110953/fileData.do">올림픽스포츠센터 강좌 정보</a>{" "}
          · 원본 파일 2026-06-01
        </li>
        <li>
          <a href="https://www.data.go.kr/data/15119388/fileData.do">기관 온라인 강습 동영상</a> ·
          원본 파일 2022-06-29
        </li>
        <li>
          <a href={`${analysisFiles}/analysis/movebridge_data_audit/phase02/analysis_report.md`}>
            MOVEBRIDGE Phase 2 분석 보고서
          </a>{" "}
          · 분류 및 연계 집계 기준
        </li>
        <li>
          <a
            href={`${analysisFiles}/Frontend/data/original/movebridge_youtube_verification_report.md`}
          >
            외부 YouTube 영상 검증 보고서
          </a>{" "}
          · 별도 검증 CSV 기준
        </li>
      </ul>
    </Panel>
  );
}

export default function DataDashboard() {
  useEffect(() => {
    const target = contents.find(([id]) => window.location.hash === `#${id}`);
    if (target) document.getElementById(target[0])?.scrollIntoView();
  }, []);

  const cards = [
    ["전체 공개 강좌 기록", totals.raw_courses, "공개 강좌 기록 행", "calendar"],
    ["2026년 공개 강좌 기록", totals.service_courses, "2026년 수강월 기준", "calendar"],
    ["2026년 이전 기록", historicalCount, "과거 분석 전용", "calendar"],
    ["일반 강좌 검색 대상", totals.searchable_courses, "2026년 기록 중 기본 검색 가능", "search"],
    ["공공기관 공개 영상", totals.institution_videos, "기관 개방 메타데이터 전체", "play"],
    ["외부 YouTube 영상", totals.external_videos, "별도 검증 목록", "play"],
  ] as const;
  return (
    <div className="dashboard-stack dashboard-page">
      <div className="stats-grid" aria-label="데이터 활용 개요">
        {cards.map(([label, value, note, icon]) => (
          <div className="stat-card" key={label}>
            <p>{label}</p>
            <div className="stat-value">
              <span className="stat-icon" aria-hidden="true">
                <Icon name={icon} size={23} />
              </span>
              <strong>
                {number(value)}
                <span>건</span>
              </strong>
            </div>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="info-box dashboard-note">
        <Icon name="info" size={18} />
        <p>
          강좌 수치는 공개 강좌 기록 행을 셉니다. 현재 운영 강좌 수·모집·잔여석은 미확인입니다. 과거
          강좌는 분석에만 사용하며, 외부 YouTube는 기관 개방 공공데이터와 별도로 집계합니다.
        </p>
      </div>
      <nav className="dashboard-nav" aria-label="공공데이터 분석 항목">
        {contents.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <YearAnalysis />
      <FieldComparison />
      <Panel id="data-records" title="세부 종목과 분류 근거 조회">
        <p>
          범위·연도·분야·세부 종목·분류 상태를 조합해 원본 종목과 분류 근거를 확인할 수 있습니다.
          종료일 상태는 분석 기준일에 고정되어 있습니다.
        </p>
        <AuditRecords total={totals.raw_courses} />
      </Panel>
      <VideoCoverage />
      <BeginnerAnalysis />
      <QualityAnalysis />
      <section
        id="sample-analysis"
        className="dashboard-stack"
        tabIndex={-1}
        aria-labelledby="sample-analysis-title"
      >
        <h2 id="sample-analysis-title">2026년 강좌와 기관 영상의 샘플 세부 분석</h2>
        <SampleAnalysis />
      </section>
      <Sources />
    </div>
  );
}
