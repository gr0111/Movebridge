import type { CSSProperties } from "react";
import { analyzedCourses, discoveryDistribution } from "../data/public-data-analysis";

export default function DiscoveryAnalysis() {
  const maximum = Math.max(...discoveryDistribution.flatMap((row) => [row.offline, row.online]), 1);
  const inferredBadminton = [...analyzedCourses.values()].filter(
    (course) => course.inferred && course.sport === "배드민턴",
  ).length;
  return (
    <section className="chart-card field-distribution">
      <div className="chart-heading">
        <h3>운동 분야별 강좌·기관 영상 비교</h3>
        <span className="sample-tag">첨부 샘플 집계</span>
      </div>
      <p>한국체육산업개발(주) 첨부 샘플 기준입니다. 기록마다 대표 분야 하나에 집계합니다.</p>
      <div className="distribution-legend">
        <span className="offline-key">오프라인 강좌</span>
        <span className="online-key">공공기관 영상</span>
      </div>
      <div className="distribution-rows">
        {discoveryDistribution.map((row) => (
          <div className="distribution-row" key={row.field}>
            <strong>{row.field}</strong>
            <div className="distribution-series">
              <div className="distribution-bar-row">
                <span>강좌</span>
                <div className="distribution-track">
                  <span
                    aria-hidden="true"
                    style={
                      {
                        "--distribution-width": `${(row.offline / maximum) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <b>{row.offline}</b>
              </div>
              <div className="distribution-bar-row online-series">
                <span>영상</span>
                <div className="distribution-track">
                  <span
                    aria-hidden="true"
                    style={
                      {
                        "--distribution-width": `${(row.online / maximum) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <b>{row.online}</b>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="discovery-chart-note">
        비교 기준을 보여주기 위해 0건인 분야도 표시합니다.
        {inferredBadminton > 0 &&
          ` 라켓 스포츠에는 ‘방특 배민’ 표기로 배드민턴을 추정한 강좌 ${inferredBadminton}건이 포함됩니다.`}
      </p>
      <details className="distribution-detail">
        <summary>세부 종목별 집계 보기</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">운동 분야 / 세부 종목</th>
              <th scope="col">강좌</th>
              <th scope="col">기관 영상</th>
            </tr>
          </thead>
          <tbody>
            {discoveryDistribution.flatMap(({ field, detail }) =>
              detail.map((row) => (
                <tr key={`${field}:${row.sport}`}>
                  <th scope="row">
                    {row.sport === field ||
                    field === "분류 확인 필요" ||
                    field === "운동 외 콘텐츠" ? (
                      field
                    ) : (
                      <>
                        {field}
                        <br />
                        {row.sport}
                      </>
                    )}
                  </th>
                  <td>{row.offline}</td>
                  <td>{row.online}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        <p>세부 표는 강좌나 기관 영상이 1건 이상 있는 종목을 표시합니다.</p>
      </details>
    </section>
  );
}
