import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { COURSE_LOAD_MORE_SIZE, COURSE_PAGE_SIZE } from "../../data/course-pagination";
import { experienceOptions } from "../../data/discovery";
import type { Course, Video } from "../../data/search";
import { videoContentKey } from "../bookmarks/content-key";
import {
  allRoadmapSports,
  moveRoadmap,
  roadmapFields,
  roadmapResults,
  roadmapSports,
  roadmapSteps,
  updateRoadmap,
} from "./roadmap";
import type { RoadmapField, RoadmapState } from "./roadmap";
import "./roadmap.css";

type Props = {
  state: RoadmapState;
  onChange: (next: RoadmapState) => void;
  renderCourse: (course: Course) => ReactNode;
  renderVideo: (video: Video, index: number) => ReactNode;
  bookmarkStatus: ReactNode;
  bookmarksReady: boolean;
  savedCourses: readonly Course[];
  planSummary: ReactNode;
  openSchedule: () => void;
  addWorkout: () => void;
};

const stageHeadings = [
  "관심 있는 운동을 골라 보세요",
  "온라인 영상 살펴보기",
  "오프라인 스포츠센터 강좌 찾기",
  "나의 운동 계획 세우기",
] as const;

export default function WorkoutRoadmap({
  state,
  onChange,
  renderCourse,
  renderVideo,
  bookmarkStatus,
  bookmarksReady,
  savedCourses,
  planSummary,
  openSchedule,
  addWorkout,
}: Props) {
  const { step, field, experience, sport } = state;
  const heading = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef(step);
  const move = (index: number) => onChange(moveRoadmap(state, index));
  const recommendations = step === 1 || step === 2 ? roadmapResults(state) : null;
  const conditionsKey = JSON.stringify([field, experience, sport]);

  useEffect(() => {
    if (lastStep.current !== step) {
      lastStep.current = step;
      heading.current?.focus();
    }
  }, [step]);

  return (
    <div className="container subpage roadmap">
      <header className="page-heading">
        <h1>나의 운동 첫걸음</h1>
        <p>관심 있는 운동을 골라 영상과 강좌를 살펴보고, 시간표에서 나만의 운동을 계획해 보세요.</p>
      </header>
      <nav aria-label="운동 첫걸음 단계">
        <ol className="roadmap-steps">
          {roadmapSteps.map((title, index) => (
            <li key={title} aria-current={step === index ? "step" : undefined}>
              <span className="roadmap-step-number">{index + 1}</span>
              {title}
            </li>
          ))}
        </ol>
      </nav>
      <section className="roadmap-stage" aria-labelledby="roadmap-stage-title">
        <div className="roadmap-stage-top">
          <div>
            <h2 ref={heading} tabIndex={-1} id="roadmap-stage-title">
              {stageHeadings[step]}
            </h2>
            <p>
              {field} · {experience}
              {sport !== allRoadmapSports && ` · ${sport}`}
            </p>
          </div>
          {step > 0 && (
            <button className="text-button" type="button" onClick={() => move(0)}>
              선택 조건 바꾸기
            </button>
          )}
        </div>
        <div className="roadmap-actions" aria-label="로드맵 단계 이동">
          {step > 0 && (
            <button className="secondary-button" type="button" onClick={() => move(step - 1)}>
              이전 단계
            </button>
          )}
          {step < roadmapSteps.length - 1 && (
            <button className="primary-button" type="button" onClick={() => move(step + 1)}>
              다음 단계 · {roadmapSteps[step + 1]}
            </button>
          )}
        </div>
        {step === 0 && (
          <div className="roadmap-options">
            <label>
              관심 운동 분야
              <select
                id="roadmap-field"
                value={field}
                onChange={(event) =>
                  onChange(updateRoadmap(state, { field: event.target.value as RoadmapField }))
                }
              >
                {roadmapFields.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>운동 경험 수준</legend>
              <div className="roadmap-actions experience-options">
                {experienceOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={value === experience}
                    className={`experience-option${value === experience ? " selected" : ""}`}
                    onClick={() => onChange(updateRoadmap(state, { experience: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              세부 운동 종목 (선택)
              <select
                id="roadmap-sport"
                value={sport}
                onChange={(event) => onChange(updateRoadmap(state, { sport: event.target.value }))}
              >
                <option>{allRoadmapSports}</option>
                {roadmapSports(field).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {recommendations && (
          <>
            {bookmarkStatus}
            <p className="roadmap-guidance">
              같은 종목과 같은 분야 대안은 각각의 공개 자료입니다. 영상이 특정 강좌의 공식 강습인지
              확인되지 않았어요. 제목의 입문 표현과 외부 영상의 표본 추천운동경험은 탐색 순서에
              따로 활용합니다.
            </p>
            {step === 1 ? (
              <RoadmapResults
                key={`video:${conditionsKey}`}
                records={recommendations.videos}
                kind="video"
                sport={sport}
                render={renderVideo}
                recordKey={(video) => videoContentKey(video) ?? `${video.source}:${video.id}`}
                edit={() => move(0)}
              />
            ) : (
              <>
                <p className="roadmap-guidance">
                  강좌별 센터명과 신청 URL은 첨부 자료에 제공되지 않아요. 운영·신청 안내는
                  제공기관에서 확인해 주세요.
                </p>
                <a
                  className="text-button"
                  href="https://www.ksponco.or.kr/menu.es?mid=a10401070000"
                  target="_blank"
                  rel="noreferrer"
                >
                  한국체육산업개발 공식 수강 안내
                </a>
                <RoadmapResults
                  key={`course:${conditionsKey}`}
                  records={recommendations.courses}
                  kind="course"
                  sport={sport}
                  render={renderCourse}
                  recordKey={(course) => course.id}
                  edit={() => move(0)}
                />
              </>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <p className="roadmap-guidance">
              북마크로 자료를 모아 보세요. 실제 수강 신청은 제공기관에서 진행하고, 운동 완료는
              시간표에서 직접 기록할 수 있어요.
            </p>
            {bookmarkStatus}
            <div className="roadmap-actions">
              <button type="button" className="secondary-button" onClick={openSchedule}>
                운동 시간표 보기
              </button>
              <button type="button" className="primary-button" onClick={addWorkout}>
                개인 운동 일정 추가
              </button>
            </div>
            {bookmarksReady && (
              <div className="roadmap-saved">
                <h3>저장한 강좌 {savedCourses.length}개</h3>
                {savedCourses.length ? (
                  <>
                    <ul>
                      {savedCourses.slice(0, 5).map((course) => (
                        <li key={course.id}>{course.title}</li>
                      ))}
                    </ul>
                    {savedCourses.length > 5 && <p>전체 목록은 운동 시간표에서 볼 수 있어요.</p>}
                  </>
                ) : (
                  <p>강좌를 북마크하면 여기에 모아 볼 수 있어요.</p>
                )}
              </div>
            )}
            {planSummary}
          </>
        )}
      </section>
    </div>
  );
}

type Result<T> = {
  record: T;
  field: string;
  sport: string | null;
  relationship: "sport" | "field";
  introductoryTitle: boolean;
  inferred: boolean;
};

function RoadmapResults<T extends Course | Video>({
  records,
  kind,
  sport,
  render,
  recordKey,
  edit,
}: {
  records: readonly Result<T>[];
  kind: "video" | "course";
  sport: string;
  render: (record: T, index: number) => ReactNode;
  recordKey: (record: T) => string | number;
  edit: () => void;
}) {
  const isCourse = kind === "course";
  const [limit, setLimit] = useState(isCourse ? COURSE_PAGE_SIZE : 6);
  const increment = isCourse ? COURSE_LOAD_MORE_SIZE : 6;
  const noun = isCourse ? "강좌" : "영상";
  const direct = records.filter((row) => row.relationship === "sport" && !row.inferred).length;
  const inferredMatches = records.filter(
    (row) => row.relationship === "sport" && row.inferred,
  ).length;
  const shown = records.slice(0, limit);
  const groups = sport === allRoadmapSports ? [{ title: null, rows: shown }] : [
    { title: "같은 종목", rows: shown.filter((row) => row.relationship === "sport") },
    { title: "같은 분야 대안", rows: shown.filter((row) => row.relationship === "field") },
  ];

  return (
    <div className="roadmap-results">
      {records.length > 0 ? (
        <>
          <p aria-live="polite">
            {noun} {records.length}건
            {sport !== allRoadmapSports &&
              ` · 같은 종목 ${direct}건${inferredMatches ? ` · 추정 일치 ${inferredMatches}건` : ""} · 같은 분야 ${records.length - direct - inferredMatches}건`}
          </p>
          {sport !== allRoadmapSports && !direct && !inferredMatches && (
            <p>선택한 종목과 일치하는 {noun}이 없어 같은 분야의 자료를 표시해요.</p>
          )}
          {groups.filter(({ rows }) => rows.length).map(({ title, rows }) => (
            <div className="result-group" key={title ?? kind}>
              {title && <h3>{title}</h3>}
              <ul className={`${kind}-grid roadmap-result-grid`}>
                {rows.map(({ record, relationship, field, sport: discipline, introductoryTitle, inferred }, index) => (
                  <li key={recordKey(record)}>
                    <p className="roadmap-evidence">
                      <strong>
                        {relationship === "sport"
                          ? inferred
                            ? "선택한 종목과 추정 일치"
                            : "선택한 종목과 일치"
                          : sport === allRoadmapSports
                            ? "해당 운동 분야"
                            : "관련 운동 분야"}
                      </strong>
                      {discipline ? ` · ${discipline}` : ` · ${field} · 세부 종목 미확인`}
                      {inferred && <span>종목 추정</span>}
                      {isCourse && introductoryTitle && <span>제목에 입문 표현</span>}
                    </p>
                    {render(record, index)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {records.length > limit && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setLimit((value) => value + increment)}
            >
              {noun} {Math.min(increment, records.length - limit)}개 더 보기
            </button>
          )}
        </>
      ) : (
        <div className="compact-empty">
          <p>
            {kind === "video" && sport !== allRoadmapSports
              ? "첨부 자료에서 같은 종목과 같은 분야의 연계 영상을 찾지 못했어요. 오프라인 강좌는 다음 단계에서 살펴볼 수 있어요."
              : `첨부 자료에서 관련 ${noun}을 찾지 못했어요. 다른 분야나 세부 종목을 골라 보세요.`}
          </p>
          <button className="text-button" type="button" onClick={edit}>
            다른 운동 찾아보기
          </button>
        </div>
      )}
    </div>
  );
}
