import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { days } from "../../data/search";
import type { Course, Video } from "../../data/search";
import { bookmarkKind } from "../bookmarks/content-key";
import type { useBookmarks } from "../bookmarks/useBookmarks";
import { weeklyPreview } from "./mypage-view";
import { defaultDisplayName, joinedOn, validateDisplayName } from "./profile";
import { useProfile } from "./useProfile";
import WorkoutSummary from "../workout-planner/WorkoutSummary";
import type { useWorkoutPlanner } from "../workout-planner/useWorkoutPlanner";
import "./mypage.css";

type Props = {
  client: SupabaseClient;
  user: User;
  bookmarks: ReturnType<typeof useBookmarks>;
  planner: ReturnType<typeof useWorkoutPlanner>;
  courses: readonly Course[];
  videos: readonly Video[];
  formatTime: (time: number) => string;
  renderCourse: (course: Course) => ReactNode;
  renderVideo: (video: Video, index: number) => ReactNode;
  openCourse: (course: Course) => void;
  navigate: (page: "home" | "schedule") => void;
  openAccount: () => void;
  openRoadmap: () => void;
};

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="mypage-message">
      <p role="alert">{message}</p>
      <button type="button" className="text-button" onClick={retry}>
        다시 불러오기
      </button>
    </div>
  );
}

export default function MyPage({
  client,
  user,
  bookmarks,
  planner,
  courses,
  videos,
  formatTime,
  renderCourse,
  renderVideo,
  openCourse,
  navigate,
  openAccount,
  openRoadmap,
}: Props) {
  const profile = useProfile(client, user.id);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const week = weeklyPreview(courses, days).filter(({ courses }) => courses.length > 0);
  const sessions = week.reduce((sum, day) => sum + day.courses.length, 0);

  async function saveNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { name, error } = validateDisplayName(draftName);
    setProfileError(error);
    setProfileNotice("");
    if (error) return;
    try {
      if (await profile.save(name)) {
        setEditing(false);
        setProfileNotice("닉네임을 저장했어요.");
      }
    } catch {
      setProfileError("닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="mypage">
      <section className="mypage-panel" aria-labelledby="member-title">
        <h2 id="member-title">회원 정보</h2>
        <dl className="mypage-profile">
          <div>
            <dt>이메일</dt>
            <dd>{user.email ?? "확인할 수 없음"}</dd>
          </div>
          {profile.state.status === "ready" && (
            <>
              <div>
                <dt>닉네임</dt>
                <dd>{profile.state.profile.display_name ?? defaultDisplayName}</dd>
              </div>
              <div>
                <dt>가입일</dt>
                <dd>{joinedOn(profile.state.profile.created_at)}</dd>
              </div>
            </>
          )}
        </dl>
        {profile.state.status === "loading" && <p role="status">프로필을 불러오는 중이에요.</p>}
        {profile.state.status === "error" && (
          <LoadError message="프로필을 불러오지 못했어요." retry={profile.retry} />
        )}
        {profile.state.status === "ready" && !editing && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (profile.state.status !== "ready") return;
              setDraftName(profile.state.profile.display_name ?? "");
              setProfileNotice("");
              setEditing(true);
            }}
          >
            닉네임 수정
          </button>
        )}
        {editing && (
          <form className="mypage-form" onSubmit={saveNickname} aria-busy={profile.saving}>
            <label htmlFor="profile-display-name">닉네임</label>
            <input
              id="profile-display-name"
              autoComplete="nickname"
              autoFocus
              value={draftName}
              aria-invalid={Boolean(profileError)}
              aria-describedby={
                profileError ? "profile-name-hint profile-name-error" : "profile-name-hint"
              }
              disabled={profile.saving}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <p id="profile-name-hint">2~24자. 비워 두면 ‘무브릿 회원’으로 표시돼요.</p>
            {profileError && (
              <p id="profile-name-error" className="bookmark-error" role="alert">
                {profileError}
              </p>
            )}
            <div className="mypage-actions">
              <button className="primary-button" type="submit" disabled={profile.saving}>
                {profile.saving ? "저장 중…" : "닉네임 저장"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={profile.saving}
                onClick={() => {
                  setEditing(false);
                  setProfileError("");
                }}
              >
                취소
              </button>
            </div>
          </form>
        )}
        {profileNotice && <p role="status">{profileNotice}</p>}
      </section>

      <WorkoutSummary planner={planner} openSchedule={() => navigate("schedule")} />
      <button type="button" className="secondary-button mypage-roadmap-link" onClick={openRoadmap}>
        나의 운동 첫걸음
      </button>

      {bookmarks.loading && <p role="status">저장한 강좌를 불러오는 중이에요.</p>}
      {bookmarks.status === "error" && (
        <LoadError message="저장한 강좌와 시간표를 불러오지 못했어요." retry={bookmarks.retry} />
      )}
      {bookmarks.ready && (
        <>
          <section className="mypage-panel" aria-labelledby="weekly-preview-title">
            <div className="mypage-section-heading">
              <div>
                <h2 id="weekly-preview-title">나의 운동 시간표 미리보기</h2>
                <p>
                  저장한 강좌 {courses.length}개 · 주간 일정 {sessions}건
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("schedule")}
              >
                운동 시간표 전체 보기
              </button>
            </div>
            {week.length ? (
              <div className="mypage-week">
                {week.map(({ day, courses }) => (
                  <section key={day} aria-label={`${day}요일 일정`}>
                    <h3>
                      {day}요일 · {courses.length}건
                    </h3>
                    <ul>
                      {courses.slice(0, 2).map((course) => (
                        <li key={course.id}>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => openCourse(course)}
                          >
                            <span>{course.title}</span>
                            <small>
                              {formatTime(course.start)}–{formatTime(course.end)}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {courses.length > 2 && <small>외 {courses.length - 2}건</small>}
                  </section>
                ))}
              </div>
            ) : (
              <p>시간표에 표시할 일정이 아직 없어요.</p>
            )}
          </section>

          <section aria-labelledby="saved-courses-title">
            <div className="mypage-section-heading">
              <h2 id="saved-courses-title">저장한 강좌 {courses.length}개</h2>
            </div>
            {courses.length ? (
              <>
                <p className="mypage-caption">스포츠센터명은 강좌 데이터에 제공되지 않아요.</p>
                <div className="course-grid mypage-course-grid">{courses.map(renderCourse)}</div>
              </>
            ) : (
              <div className="mypage-panel">
                <p>아직 저장한 강좌가 없어요.</p>
                <button type="button" className="secondary-button" onClick={() => navigate("home")}>
                  운동 찾으러 가기
                </button>
              </div>
            )}
          </section>

          <section aria-labelledby="saved-videos-title">
            <div className="mypage-section-heading">
              <h2 id="saved-videos-title">저장한 온라인 영상 {videos.length}개</h2>
            </div>
            {videos.length ? (
              <div className="video-grid">{videos.map(renderVideo)}</div>
            ) : (
              <div className="mypage-panel">
                <p>아직 저장한 온라인 영상이 없어요.</p>
              </div>
            )}
          </section>

          {bookmarks.unavailable.size > 0 && (
            <section className="mypage-panel" aria-labelledby="unavailable-title">
              <h2 id="unavailable-title">연결되지 않는 북마크 {bookmarks.unavailable.size}건</h2>
              <p>
                현재 강좌 또는 영상 데이터와 연결할 수 없는 항목입니다. 저장 키를 확인하고 필요할 때
                삭제할 수 있어요.
              </p>
              <ul className="mypage-unavailable">
                {[...bookmarks.unavailable].map((key) => {
                  const pending = bookmarks.pending.has(key);
                  return (
                    <li key={key}>
                      <span>
                        {bookmarkKind(key) === "video" ? "영상" : "강좌"} · <code>{key}</code>
                      </span>
                      {confirming === key ? (
                        <div className="mypage-confirm">
                          <p>이 북마크를 삭제할까요?</p>
                          <div className="mypage-actions">
                            <button
                              type="button"
                              className="primary-button bookmark-action"
                              disabled={pending}
                              onClick={() => bookmarks.removeUnavailable(key)}
                            >
                              {pending ? "삭제 중…" : "북마크 삭제 확인"}
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={pending}
                              autoFocus
                              onClick={() => setConfirming(null)}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={pending}
                          onClick={() => setConfirming(key)}
                        >
                          삭제
                        </button>
                      )}
                      {bookmarks.errors.has(key) && (
                        <p role="alert" className="bookmark-error">
                          {bookmarks.errors.get(key)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mypage-panel" aria-labelledby="account-title">
        <h2 id="account-title">계정</h2>
        <button type="button" className="secondary-button" onClick={openAccount}>
          계정 메뉴 열기
        </button>
      </section>
    </div>
  );
}
