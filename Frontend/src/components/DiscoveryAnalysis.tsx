import type { CSSProperties } from "react";
import { discoveryDistribution, beginnerTotals } from "../data/discovery";

export default function DiscoveryAnalysis() {
  const maximum = Math.max(...discoveryDistribution.flatMap((row) => [row.offline, row.online]), 1);
  return (
    <section className="chart-card field-distribution">
      <div className="chart-heading">
        <h3>관심 분야별 강좌·영상 분포 비교</h3>
        <span className="sample-tag">첨부 샘플 집계</span>
      </div>
      <p>분야별 실제 기록 수 (건) · 한 기록은 하나의 대표 분야에 집계합니다.</p>
      <div className="distribution-legend">
        <span className="offline-key">오프라인 강좌</span>
        <span className="online-key">온라인 영상</span>
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
        원본 제목의 입문 표현 확인: 강좌 {beginnerTotals.offline}건 · 영상 {beginnerTotals.online}
        건. 설명 필드가 없어 제목만 분석했으며, 공식 난이도·적합성 인증이나 운동 수요를 뜻하지
        않습니다.
      </p>
      <span className="chart-note">
        분류 근거가 없는 기록과 운동 외 콘텐츠도 별도 집계하며 전체 공공데이터의 분포를 대표하지
        않습니다.
      </span>
    </section>
  );
}
