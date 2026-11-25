import type { ReactNode } from "react";
import Icon from "./Icon";
import { groupByBeginner } from "../data/discovery";
import type { DiscoveryFilters, ResultSort, searchDiscovery } from "../data/discovery";
import { courses, searchableCourses, excludedCourses } from "../data/search";
import type { Course, Video } from "../data/search";
import { COURSE_LOAD_MORE_SIZE, visibleCourseRecords } from "../data/course-pagination";

type Props = {
  results: ReturnType<typeof searchDiscovery>;
  filters: DiscoveryFilters;
  searched: boolean;
  sort: ResultSort;
  onSort: (sort: ResultSort) => void;
  courseLimit: number;
  videoLimit: number;
  onMoreCourses: () => void;
  onMoreVideos: () => void;
  onReset: () => void;
  renderCourse: (course: Course, showBeginner: boolean) => ReactNode;
  renderVideo: (video: Video, index: number, showBeginner: boolean) => ReactNode;
};

function ResultGroups<T extends { title: string }>({
  records,
  limit,
  grouped,
  kind,
  render,
}: {
  records: T[];
  limit: number;
  grouped: boolean;
  kind: "course" | "video";
  render: (record: T, index: number) => ReactNode;
}) {
  if (!grouped) return <div className={`${kind}-grid`}>{records.slice(0, limit).map(render)}</div>;
  const groups = groupByBeginner(records);
  const shown =
    kind === "course"
      ? groupByBeginner(visibleCourseRecords(records, limit))
      : {
          first: groups.first.slice(0, limit),
          other: groups.other.slice(0, limit),
        };
  return (
    <div className="result-groups">
      <section className="result-group">
        <h3>
          먼저 살펴볼 자료 <span>{groups.first.length}건</span>
        </h3>
        <p>
          {kind === "video"
            ? "원본 제목에 입문 관련 표현이 있는 기관 영상과 표본 평가가 입문·기초인 외부 영상입니다."
            : "원본 제목에서 입문·초급·기초·Beginner 표현이 직접 확인된 강좌 기록입니다."}
        </p>
        {groups.first.length ? (
          <div className={`${kind}-grid`}>{shown.first.map(render)}</div>
        ) : (
          <div className="compact-empty">
            현재 검색 조건에서 입문 관련 표현이 확인된 {kind === "video" ? "영상" : "강좌"} 기록은
            없어요.
          </div>
        )}
      </section>
      {groups.other.length > 0 && (
        <section className="result-group">
          <h3>
            같은 분야의 다른 자료 <span>{groups.other.length}건</span>
          </h3>
          <p>현재 분야·세부 검색 조건에 일치하지만 입문 관련 표현은 확인되지 않은 기록입니다.</p>
          {shown.other.length ? (
            <div className={`${kind}-grid`}>{shown.other.map(render)}</div>
          ) : (
            <p>
              입문 표현 확인 자료를 먼저 표시하고 있습니다. 더 보기를 누르면 같은 분야의 다른 기록도
              이어서 표시됩니다.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
const hasMore = (records: { title: string }[], limit: number, grouped: boolean) => {
  const groups = groupByBeginner(records);
  return grouped
    ? Math.max(groups.first.length, groups.other.length) > limit
    : records.length > limit;
};

export default function DiscoveryResults({
  results,
  filters,
  searched,
  sort,
  onSort,
  courseLimit,
  videoLimit,
  onMoreCourses,
  onMoreVideos,
  onReset,
  renderCourse,
  renderVideo,
}: Props) {
  const beginner = searched && filters.experience === "처음 시작";
  const grouped = beginner && results.prioritize;
  const introCount = groupByBeginner([...results.online, ...results.offline]).first.length;
  const sortControl = (
    <label className="sort-select">
      <select
        aria-label="강좌 정렬"
        value={sort}
        onChange={(event) => onSort(event.target.value as ResultSort)}
      >
        <option value="default">기본순{beginner ? " · 입문 표현 우선" : ""}</option>
        <option value="price">수강금액 낮은순</option>
        <option value="time">시작시간 빠른순</option>
      </select>
    </label>
  );
  return (
    <div className="discovery-results">
      {searched && (
        <>
          <div className="discovery-results-heading">
            <div>
              <h2>나의 조건으로 찾은 공개 자료</h2>
              <p>
                첨부 샘플 내 온라인 {results.online.length}건 · 오프라인 {results.offline.length}건
                · 참고영상은 별도 표시
              </p>
            </div>
            {sortControl}
          </div>
          <div className="discovery-guidance">
            <Icon name="info" size={17} />
            <div>
              <p>
                {beginner
                  ? sort === "default"
                    ? "기본순에서는 제목에 입문 관련 표현이 있는 공공자료와 표본 평가가 입문·기초인 외부 영상을 먼저 표시합니다."
                    : "직접 선택한 강좌 정렬을 우선합니다. 영상은 금액·시간 정렬 대상이 아니므로 원본 순서를 유지하며, 원본 표현은 라벨로 구분합니다."
                  : filters.experience === "운동 경험 있음"
                    ? "외부 영상은 CSV의 추천 운동 경험이 중급·고급인 기록을 표시합니다. 공공자료는 기존 검색 기준을 적용합니다."
                    : "선택한 관심 분야와 기존 검색 조건으로 자료를 탐색합니다."}
              </p>
              <p>
                관심 분야는 편의상 분류이며, 입문 표현은 난이도·운동 적합성 인증이 아닙니다.
                온라인과 오프라인은 같은 분야의 독립 자료로, 특정 강좌와 영상의 1:1 연결이 아닙니다.
              </p>
              {beginner && introCount === 0 && (
                <strong>
                  {results.online.length + results.offline.length > 0
                    ? "현재 검색 조건 기준으로, 선택한 분야에서 입문 관련 표현이 확인된 자료는 없어요. 대신 같은 분야의 다른 공개 자료를 살펴볼 수 있어요."
                    : "현재 선택한 분야와 검색 조건에 일치하는 공개 자료가 없어요. 분야나 세부 조건을 변경해 주세요."}
                </strong>
              )}
            </div>
          </div>
        </>
      )}
      {(!searched || filters.mode !== "offline") && (
        <section className="online-results" aria-labelledby="online-results-title">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">MOVE ANYWHERE</span>
              <h2 id="online-results-title">
                온라인 관련 콘텐츠 <span className="sample-tag">첨부 샘플</span>
              </h2>
              <p>
                조건에 일치하는 영상 {results.online.length}건 · 공공기관{" "}
                {results.online.filter((video) => video.source === "institution").length}건 · 외부 YouTube{" "}
                {results.online.filter((video) => video.source === "youtube").length}건
              </p>
            </div>
            <span className="quiet-label">
              <Icon name="play" size={16} />
              온라인 운동영상
            </span>
          </div>
          <div className="example-notice">
            <Icon name="info" size={14} />
            <span>
              공공기관 영상은 공개 메타데이터와 일반 이미지를 사용합니다. 외부 YouTube 영상의
              난이도는 검증 CSV에 기록된 표본 구간 기준입니다. 요일·시간·금액 조건은 강좌에 적용됩니다.
            </span>
          </div>
          {results.online.length ? (
            <ResultGroups
              records={results.online}
              limit={videoLimit}
              grouped={grouped}
              kind="video"
              render={(video, index) => renderVideo(video, index, beginner)}
            />
          ) : (
            <div className="compact-empty">
              첨부 샘플에 선택한 분야와 검색어에 일치하는 영상 기록이 없어요. 다른 분야나 검색어를
              선택해 주세요. 전체 서비스 데이터의 부재를 의미하지 않습니다.
            </div>
          )}
          {hasMore(results.online, videoLimit, grouped) && (
            <div className="load-more">
              <button className="secondary-button" onClick={onMoreVideos}>
                첨부 영상 더 보기
                {grouped
                  ? " · 표현 그룹별"
                  : ` (${Math.min(videoLimit, results.online.length)} / ${results.online.length})`}
                <Icon name="chevron" size={16} />
              </button>
            </div>
          )}
          {results.related.length > 0 && (
            <>
              <h3 className="reference-heading">
                같은 분야 참고영상{" "}
                <span>직접 검색어 일치 결과와 별도이며, 특정 강좌와 연결되지 않습니다.</span>
              </h3>
              <div className="video-grid">
                {results.related.map((video, index) => renderVideo(video, index, beginner))}
              </div>
            </>
          )}
        </section>
      )}
      {(!searched || filters.mode !== "online") && (
        <section className="offline-results" aria-labelledby="offline-results-title">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">MOVE TOGETHER</span>
              <h2 id="offline-results-title">
                {searched ? "오프라인 관련 강좌" : "공개 기록으로 만나는 새로운 움직임"}{" "}
                <span className="sample-tag">첨부 샘플</span>
              </h2>
              <p>
                {searched
                  ? `첨부 샘플 내 조건 일치 ${results.offline.length}건 · 서비스 전체 검색 결과가 아닙니다.`
                  : `공개 강좌 기록 ${results.offline.length}건 중 일부입니다. 현재 운영·모집 여부를 의미하지 않습니다.`}
              </p>
              <p>
                원본 {courses.length}건 중 일반 강좌 탐색 대상 {searchableCourses.length}건 · 종목
                확인 불가로 기본 제외 {excludedCourses.length}건. 원본 행은 삭제하지 않았습니다.
              </p>
            </div>
            {!searched && sortControl}
          </div>
          <div className="example-notice">
            <Icon name="info" size={14} />
            <span>
              강좌명·요일·시간·금액은 첨부 CSV 원문 기준입니다. 선택한 요일을 모두 포함하는 기본
              표기만 검색하며, 의미 확인이 필요한 괄호 안 요일은 검색·시간표에서 제외합니다.
            </span>
          </div>
          {results.offline.length ? (
            <ResultGroups
              records={results.offline}
              limit={courseLimit}
              grouped={grouped}
              kind="course"
              render={(course) => renderCourse(course, beginner)}
            />
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="search" size={30} />
              </span>
              <h3>현재 선택한 조건과 일치하는 공개 강좌 기록이 없어요.</h3>
              <p>
                첨부 샘플 범위 내 결과입니다. 전체 자료의 부재를 의미하지 않아요.
                <br />
                가능한 요일이나 시간, 예산 또는 관심 분야를 조금 넓혀보세요.
              </p>
              <div className="relax-options">
                {[
                  "가능한 요일 늘리기",
                  "최대 수강금액 높이기",
                  "시간 범위 넓히기",
                  "관심 종목 다시 선택하기",
                ].map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
              <button className="secondary-button" onClick={onReset}>
                조건 다시 선택하기
                <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
          {results.offline.length > courseLimit && (
            <div className="load-more">
              <button className="secondary-button" onClick={onMoreCourses}>
                강좌 {Math.min(COURSE_LOAD_MORE_SIZE, results.offline.length - courseLimit)}개 더 보기
                {` (${Math.min(courseLimit, results.offline.length)} / ${results.offline.length})`}
                <Icon name="chevron" size={16} />
              </button>
            </div>
          )}
          <p className="section-footnote">
            <Icon name="info" size={14} />
            공개 데이터 수강금액의 결제 주기는 확인이 필요해요. 실제 운영 여부와 일정은 별도로
            확인해 주세요.
          </p>
        </section>
      )}
    </div>
  );
}
