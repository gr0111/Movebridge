import type { CSSProperties } from "react";
import Icon from "../../components/Icon";
import DiscoveryAnalysis from "../../components/DiscoveryAnalysis";
import { beginnerChart } from "../../data/discovery";
import {
  courses,
  searchableCourses,
  excludedCourses,
  courseExclusionSummary,
  courseEligibility,
  sampleCharts,
} from "../../data/search";
import DashboardTable from "./DashboardTable";

export default function SampleAnalysis() {
  return (
    <>
      <section
        className="info-box course-eligibility-summary"
        aria-label="강좌 탐색 대상과 기본 제외 기준"
      >
        <Icon name="info" />
        <div>
          <strong>
            원본 {courses.length}건 보존 · 일반 강좌 탐색 대상 {searchableCourses.length}건 · 기본
            제외 {excludedCourses.length}건
          </strong>
          <p>
            아래 그래프는 제외 기록도 포함한 2026년 강좌 샘플 기준입니다. 검색 결과는 탐색 대상에서
            선택한 조건에 일치하는 기록만 표시합니다. ‘자유이용’ 같은 제목만으로 시설 이용권이라고
            확정하지 않으며, 종목이 확인되는 자율이용·방학특강은 일괄 제외하지 않습니다.
          </p>
          <details>
            <summary>기본 제외 사유와 원본 기록 확인</summary>
            <ul>
              {courseExclusionSummary.map((item) => (
                <li key={item.reason}>
                  {item.reason} · {item.count}건
                </li>
              ))}
            </ul>
            <ul>
              {excludedCourses.map((course) => (
                <li key={course.id}>
                  원본 일련번호 {course.id} · {course.title} · 원본 종목 {course.sport} ·{" "}
                  {courseEligibility.get(course.id)!.exclusionReason}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
      <div className="info-box">
        <Icon name="info" />
        <div>
          <strong>첨부 샘플 범위의 집계입니다. 서비스 전체 통계가 아닙니다.</strong>
          <p>
            그래프는 첨부 CSV의 실제 기록을 집계합니다. 요일은 기본 표기만 반영하고 괄호 안 요일은
            제외합니다. 여러 요일의 강좌는 각 요일에 중복 집계되며, 원본 종목 표기 그래프는 상위
            5개를 개별 표시합니다. 집계 범위는 첨부 샘플로, 현재 운영 현황이나 수요를 뜻하지
            않습니다.
          </p>
        </div>
      </div>
      <div className="charts-grid">
        {sampleCharts.map((chart, index) => (
          <BarChart
            key={chart.title}
            id={`sample-chart-${index}`}
            scope={`2026년 강좌 ${courses.length}건`}
            {...chart}
          />
        ))}
      </div>
      <section className="discovery-analytics">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">CONTENT EXPLORATION</span>
            <h2>운동 종목 분포와 입문 관련 표현</h2>
            <p>
              원본 강좌 400건과 공공기관 영상 56건을 집계합니다. 외부 YouTube 영상 131건은 별도
              집계합니다.
            </p>
          </div>
        </div>
        <div className="charts-grid">
          <DiscoveryAnalysis />
          <div className="beginner-analysis">
            <BarChart
              id="sample-intro"
              scope={`2026년 강좌 ${courses.length}건 · 기관 영상 56건`}
              {...beginnerChart}
            />
            <div className="info-box">
              <Icon name="info" size={18} />
              <div>
                <strong>원본 제목의 표현을 집계한 지표입니다.</strong>
                <p>
                  두 공공데이터 샘플에는 설명 필드가 없어 원본 강좌명과 영상 제목에서
                  입문·초급·기초·Beginner를 확인합니다. 기초체력·기초대사량과 초급/중급 등 혼합 수준
                  표기는 제외합니다. 실제 난이도와 개인별 적합성은 별도 확인이 필요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function BarChart({
  id,
  scope,
  title,
  labels,
  values,
}: {
  id: string;
  scope: string;
  title: string;
  labels: string[];
  values: number[];
}) {
  return (
    <section className="chart-card">
      <div className="chart-heading">
        <h3>{title}</h3>
        <span className="sample-tag">첨부 샘플 집계</span>
      </div>
      <p>첨부 샘플 기록 수 (건) · 서비스 전체 통계 아님</p>
      <div className="bar-chart" aria-hidden="true">
        {labels.map((label, i) => (
          <div className="bar-item" key={label}>
            <div className="bar-track">
              <span
                style={
                  {
                    height: `${(values[i] / Math.max(...values, 1)) * 90}%`,
                    "--bar-opacity": 1 - i * 0.08,
                  } as CSSProperties
                }
              >
                <b className="bar-value">{values[i]}</b>
              </span>
            </div>
            <span className="bar-label">{label}</span>
          </div>
        ))}
      </div>
      <details className="distribution-detail">
        <summary>데이터 표 보기</summary>
        <DashboardTable id={id} caption={`${title} · ${scope}`} headings={["구분", "기록 수 (건)"]}>
          {labels.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{values[index]}</td>
            </tr>
          ))}
        </DashboardTable>
      </details>
      <span className="chart-note">첨부 CSV 기준 · 현재 운영·모집 여부와 무관합니다.</span>
    </section>
  );
}
