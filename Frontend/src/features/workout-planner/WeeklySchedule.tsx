import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Icon from "../../components/Icon";
import { days } from "../../data/search";
import type { Course } from "../../data/search";
import {
  addDays,
  completionKey,
  dateWeekday,
  dayLayout,
  hourHeight,
  koreaDate,
  koreaDisplayDate,
  minimumEventHeight,
  scheduleEntries,
  weekOf,
} from "./planner-model";
import type { ScheduleEntry } from "./planner-model";
import WorkoutDialog from "./WorkoutDialog";
import type { DialogSelection, Planner } from "./WorkoutDialog";
import "./workout-planner.css";

type Props = {
  planner: Planner;
  courses: readonly Course[];
  bookmarksReady: boolean;
  formatTime: (time: number) => string;
  openCourse: (course: Course) => void;
  openAccount: () => void;
  findCourses: () => void;
};

export function PlannerStatus({ planner }: { planner: Planner }) {
  if (planner.status === "loading") return <p role="status">개인 운동 일정을 불러오는 중이에요.</p>;
  if (planner.status !== "error") return null;
  return (
    <div className="workout-load-error">
      <p role="alert">개인 운동 일정을 불러오지 못했어요.</p>
      <button type="button" className="text-button" onClick={planner.store.retry}>
        개인 일정 다시 불러오기
      </button>
    </div>
  );
}

export default function WeeklySchedule({
  planner,
  courses,
  bookmarksReady,
  formatTime,
  openCourse,
  openAccount,
  findCourses,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState<DialogSelection | null>(null);
  const [historyError, setHistoryError] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const dates = weekOf(addDays(koreaDate(), offset * 7));
  const historical = planner.completions
    .flatMap(({ plan_id, performed_on }) => {
      if (!dates.includes(performed_on)) return [];
      const plan = planner.plans.find(({ id }) => id === plan_id);
      return plan && plan.day_of_week !== dateWeekday(performed_on) ? [{ plan, performed_on }] : [];
    })
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on));
  const entries = useMemo(() => scheduleEntries(courses, planner.plans), [courses, planner.plans]);
  const layout = days.map((_, day) => dayLayout(entries.filter((entry) => entry.day === day)));
  const keys = new Set(
    planner.completions.map(({ plan_id, performed_on }) => completionKey(plan_id, performed_on)),
  );
  const start = Math.floor(entries.reduce((hour, entry) => Math.min(hour, entry.start), 6));
  const end = Math.ceil(entries.reduce((hour, entry) => Math.max(hour, entry.end), 22));
  const hours = Array.from({ length: end - start + 1 }, (_, index) => formatTime(start + index));
  const gridColumns = layout.map(({ positioned }) =>
    Math.max(105, ...positioned.map(({ lanes }) => lanes * 75)),
  );
  const gridStyle = {
    "--workout-grid-columns": `65px ${gridColumns.map((minimum) => `minmax(${minimum}px, 1fr)`).join(" ")}`,
  } as CSSProperties;
  const empty =
    !entries.length && bookmarksReady && (planner.status === "ready" || planner.status === "guest");

  function openEntry(entry: ScheduleEntry) {
    if (entry.kind === "course") openCourse(entry.source);
    else setSelection({ id: entry.source.id, creating: false });
  }

  function moveWeek(next: number) {
    setHistoryError("");
    setOffset(next);
  }

  async function cancelHistorical(id: string, date: string) {
    setHistoryError("");
    try {
      await planner.store.setCompletion(id, date, false);
    } catch {
      setHistoryError("완료 기록을 취소하지 못했어요. 다시 시도해 주세요.");
    }
  }

  function eventContent(entry: ScheduleEntry) {
    const personal = entry.kind === "personal";
    const complete = personal && keys.has(completionKey(entry.source.id, dates[entry.day]));
    return (
      <>
        <strong>{entry.title}</strong>
        <span>
          {formatTime(entry.start)}–{formatTime(entry.end)}
        </span>
        <span>{personal ? (complete ? "직접 등록 · 완료" : "직접 등록") : "공공데이터 강좌"}</span>
      </>
    );
  }

  return (
    <section className="workout-schedule" aria-label="주간 운동 일정">
      <div className="workout-week-controls">
        <div className="workout-week-range" role="status">
          <strong>
            {koreaDisplayDate(dates[0])} – {koreaDisplayDate(dates[6])}
          </strong>
          <small>
            {dates[0].slice(0, 4)}년
            {dates[0].slice(0, 4) !== dates[6].slice(0, 4) && `–${dates[6].slice(0, 4)}년`} · 한국
            시간
          </small>
        </div>
        <div className="workout-actions">
          <button type="button" className="secondary-button" onClick={() => moveWeek(offset - 1)}>
            이전 주
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => moveWeek(0)}
            disabled={!offset}
          >
            이번 주
          </button>
          <button type="button" className="secondary-button" onClick={() => moveWeek(offset + 1)}>
            다음 주
          </button>
        </div>
        <button
          type="button"
          ref={addButton}
          className="primary-button"
          disabled={planner.status === "loading" || planner.status === "error"}
          onClick={() => {
            if (!planner.owner) openAccount();
            else setSelection({ id: crypto.randomUUID(), creating: true });
          }}
        >
          운동 추가
        </button>
      </div>
      {planner.status === "guest" && (
        <p className="section-footnote">개인 운동 일정과 완료 기록을 저장하려면 로그인해 주세요.</p>
      )}
      <PlannerStatus planner={planner} />

      {layout.some(({ overlaps }) => overlaps) && (
        <div className="conflict-notice">
          <Icon name="info" size={18} />
          시간이 겹치는 운동이 있어요. 두 일정의 요일과 시간을 확인해 주세요.
        </div>
      )}
      <div
        className="timetable-wrapper workout-grid"
        style={gridStyle}
        hidden={!entries.length && !bookmarksReady}
      >
        <div className="timetable">
          <div className="timetable-top">
            <span>시간</span>
            {days.map((day, index) => (
              <span key={day}>
                {day}요일
                <br />
                {koreaDisplayDate(dates[index])}
              </span>
            ))}
          </div>
          <div className="timetable-body">
            <div className="time-labels">
              {hours.map((hour) => (
                <span key={hour}>{hour}</span>
              ))}
            </div>
            {layout.map(({ positioned }, day) => (
              <div key={days[day]} className="day-column">
                {hours.slice(0, -1).map((hour) => (
                  <div className="hour-cell" key={hour} />
                ))}
                {positioned.map(({ entry, lane, lanes }, index) => (
                  <button
                    type="button"
                    className={`calendar-event ${entry.kind === "personal" ? "personal-event" : `event-${index % 3}`}`}
                    key={entry.key}
                    onClick={() => openEntry(entry)}
                    style={{
                      top: (entry.start - start) * hourHeight,
                      height: Math.max((entry.end - entry.start) * hourHeight, minimumEventHeight),
                      width: `calc(${100 / lanes}% - 6px)`,
                      left: `calc(${(lane * 100) / lanes}% + 3px)`,
                    }}
                  >
                    {eventContent(entry)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        {empty && (
          <div className="schedule-empty">
            <Icon name="calendar" size={32} />
            <h3>이번 주 시간표가 비어 있어요.</h3>
            <p>운동을 직접 추가하거나 강좌를 북마크해 보세요.</p>
            <button type="button" className="secondary-button" onClick={findCourses}>
              운동 찾으러 가기
            </button>
          </div>
        )}
      </div>
      <div className="workout-agenda">
        {empty && <p>이번 주 시간표가 비어 있어요.</p>}
        {layout.map(
          ({ positioned }, day) =>
            positioned.length > 0 && (
              <section key={days[day]}>
                <h3>
                  {days[day]}요일 · {koreaDisplayDate(dates[day])}
                </h3>
                <ul>
                  {positioned.map(({ entry }) => (
                    <li key={entry.key}>
                      <button
                        type="button"
                        className={entry.kind === "personal" ? "personal-event" : ""}
                        onClick={() => openEntry(entry)}
                      >
                        {eventContent(entry)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>
      {historical.length > 0 && (
        <div className="saved-list workout-history">
          <h3>요일을 바꾸기 전 완료 기록</h3>
          {historical.map(({ plan, performed_on }) => (
            <div key={completionKey(plan.id, performed_on)}>
              <span>
                {plan.title} <small>{koreaDisplayDate(performed_on)}</small>
              </span>
              <button
                type="button"
                className="text-button"
                disabled={planner.pending.has(plan.id)}
                aria-label={`${plan.title} ${koreaDisplayDate(performed_on)} 완료 취소`}
                onClick={() => void cancelHistorical(plan.id, performed_on)}
              >
                완료 취소
              </button>
            </div>
          ))}
          {historyError && (
            <p className="bookmark-error" role="alert">
              {historyError}
            </p>
          )}
        </div>
      )}
      {planner.owner &&
        selection &&
        (selection.creating || planner.plans.some(({ id }) => id === selection.id)) && (
          <WorkoutDialog
            key={selection.id}
            selection={selection}
            planner={planner}
            dates={dates}
            close={() => {
              const remains =
                selection.creating ||
                planner.store.getSnapshot().plans.some(({ id }) => id === selection.id);
              setSelection(null);
              if (!remains) addButton.current?.focus();
            }}
          />
        )}
    </section>
  );
}
