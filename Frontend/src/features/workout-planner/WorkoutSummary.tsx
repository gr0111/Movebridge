import { koreaDisplayDate, workoutSummary } from "./planner-model";
import { PlannerStatus } from "./WeeklySchedule";
import type { Planner } from "./WorkoutDialog";

export default function WorkoutSummary({
  planner,
  openSchedule,
}: {
  planner: Planner;
  openSchedule: () => void;
}) {
  const summary = workoutSummary(planner.plans, planner.completions);
  return (
    <section className="mypage-panel workout-summary" aria-labelledby="workout-summary-title">
      <div className="mypage-section-heading">
        <div>
          <h2 id="workout-summary-title">개인 운동 현황</h2>
          <p>직접 등록한 운동만 집계해요.</p>
        </div>
        <button type="button" className="secondary-button" onClick={openSchedule}>
          나의 운동 시간표 열기
        </button>
      </div>
      <PlannerStatus planner={planner} />
      {planner.status === "ready" && (
        <>
          <dl className="workout-metrics">
            <div>
              <dt>직접 등록한 계획</dt>
              <dd>{planner.plans.length}개</dd>
            </div>
            <div>
              <dt>이번 주 계획</dt>
              <dd>{summary.planned}회</dd>
            </div>
            <div>
              <dt>이번 주 완료</dt>
              <dd>{summary.completed}회</dd>
            </div>
            <div>
              <dt>이번 주 완료율</dt>
              <dd>{summary.rate}%</dd>
            </div>
          </dl>
          <div>
            <h3>최근 완료 기록</h3>
            {summary.recent.length ? (
              <ul className="workout-recent">
                {summary.recent.map((record) => (
                  <li key={`${record.plan_id}:${record.performed_on}`}>
                    <time dateTime={record.performed_on}>
                      {record.performed_on.slice(0, 4)}년 {koreaDisplayDate(record.performed_on)}
                    </time>
                    <span>{record.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>아직 완료한 개인 운동 기록이 없어요.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
