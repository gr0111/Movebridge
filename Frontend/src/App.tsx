import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import Icon, { type IconName } from "./components/Icon";
import DiscoveryResults from "./components/DiscoveryResults";
import DiscoveryAnalysis from "./components/DiscoveryAnalysis";
import DetailCombobox from "./components/DetailCombobox";
import {
  interestFields,
  experienceOptions,
  searchDiscovery,
  analyzeBeginnerTitle,
  beginnerChart,
  fieldRules,
  getDetailOptions,
  updateDiscoveryFilter,
} from "./data/discovery";
import type { DiscoveryFilters as Filters, ResultSort } from "./data/discovery";
import { getCourseDisplay } from "./data/course-display";
import SportPictogram from "./components/SportPictogram";
import {
  courses,
  videos,
  days,
  sampleCharts,
  searchableCourses,
  excludedCourses,
  courseEligibility,
  courseExclusionSummary,
} from "./data/search";
import { COURSE_PAGE_SIZE, COURSE_LOAD_MORE_SIZE } from "./data/course-pagination";
import { externalVideos } from "./data/external-videos";
import type { Course, Video } from "./data/search";
import AuthControls from "./components/auth/AuthControls";
import { useBookmarks } from "./features/bookmarks/useBookmarks";

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-symbol">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="m6 18 7-11 6 4-6 10 11-6 4 6-15 7-9-5Z" fill="currentColor" />
          <circle cx="23" cy="6" r="4" fill="currentColor" />
        </svg>
      </span>
      <span>
        무브릿<span className="brand-english">MOVEBRIDGE</span>
      </span>
    </span>
  );
}

function SportsIllustration() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 530 300"
      fill="none"
      role="img"
      aria-label="라벤더 요가 매트와 운동화, 테니스 라켓을 그린 일러스트레이션"
    >
      <defs>
        <linearGradient id="mat" x1="128" y1="147" x2="323" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D4C5EA" />
          <stop offset="1" stopColor="#B29ACC" />
        </linearGradient>
        <linearGradient
          id="shoe"
          x1="250"
          y1="180"
          x2="389"
          y2="231"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFEFF" />
          <stop offset="1" stopColor="#E9E1F0" />
        </linearGradient>
        <linearGradient id="bottle" x1="105" y1="80" x2="150" y2="176">
          <stop stopColor="#E9DFEF" />
          <stop offset="1" stopColor="#C5B0D9" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <pattern id="strings" width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M0 0h11v11" stroke="#B6A2C8" strokeWidth="1" />
        </pattern>
      </defs>
      <ellipse
        cx="277"
        cy="250"
        rx="173"
        ry="15"
        fill="#B6A1CB"
        opacity=".15"
        filter="url(#shadow)"
      />
      <circle cx="285" cy="145" r="86" fill="#F5F0FA" />
      <circle cx="285" cy="145" r="76" stroke="#E5E7EB" strokeDasharray="3 7" />
      <path d="m95 222 169-83 163 78-172 74Z" fill="url(#mat)" />
      <path d="m95 222 160 69 172-74v6l-172 74-160-68Z" fill="#A98EC5" />
      <path
        d="m130 222 125 53 135-58M150 211l106 46 113-49"
        stroke="#E9DFF3"
        opacity=".55"
        strokeWidth="1.2"
      />
      <g transform="rotate(-24 347 131)">
        <path d="M339 160h15v87a7.5 7.5 0 0 1-15 0Z" fill="#7E639E" />
        <path d="m340 205 13 5m-13 4 13 5m-13 4 13 5m-13 4 13 5" stroke="#B8A3CF" strokeWidth="2" />
        <path d="m333 143 7 37h12l9-38" stroke="#A78DBF" strokeWidth="5" />
        <ellipse
          cx="347"
          cy="103"
          rx="42"
          ry="57"
          fill="#F8F5FB"
          stroke="#A78DBF"
          strokeWidth="7"
        />
        <ellipse
          cx="347"
          cy="103"
          rx="36"
          ry="51"
          fill="url(#strings)"
          stroke="#D0BEDE"
          strokeWidth="2"
        />
      </g>
      <g transform="rotate(-9 133 139)">
        <rect x="114" y="64" width="30" height="15" rx="5" fill="#9B83B3" />
        <rect x="118" y="58" width="21" height="10" rx="4" fill="#B7A0CC" />
        <path
          d="M113 79h32l6 20v80a14 14 0 0 1-14 14h-16a14 14 0 0 1-14-14V99Z"
          fill="url(#bottle)"
        />
        <rect x="107" y="112" width="44" height="46" rx="3" fill="#F7F2FA" opacity=".6" />
        <path d="m125 126-5 9 8 4 8-13" stroke="#A58BBD" strokeWidth="3" strokeLinecap="round" />
        <path d="M115 101v71" stroke="white" strokeWidth="4" strokeLinecap="round" opacity=".45" />
      </g>
      <g transform="rotate(9 280 209)">
        <path d="m206 176 24-22 40 17 18 32 54 15c13 4 17 17 12 25l-125-5-33-19Z" fill="#B9A4D0" />
        <path d="m205 181 25-20 34 15 19 31 55 15c7 2 11 5 13 10l-112-5-36-16Z" fill="#F3EDF8" />
        <path d="m199 209 36 16 117 7 3 11c-25 9-91 4-122-1l-38-20Z" fill="#DDD0EB" />
        <path d="m207 216 29 14 108 8" stroke="#FDFBFF" strokeWidth="4" strokeLinecap="round" />
        <path
          d="m239 180 27 8m-21 0 26 8m-21 0 25 8"
          stroke="#A68BBB"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path d="m291 218 16-2 12 9-21-1Z" fill="#C4AED7" />
        <path d="m215 183 11 12-9 13-13-4" fill="#D4C3E4" />
      </g>
      <g transform="rotate(-12 331 224)">
        <path
          d="m265 185 24-16 32 14 17 29 48 11c14 3 20 14 15 24l-114-1-34-19Z"
          fill="url(#shoe)"
        />
        <path d="m257 216 33 17 110 3 3 12c-20 10-84 7-115 3l-35-20Z" fill="#CEC0DF" />
        <path d="m258 226 33 17 104 1" stroke="#FFFCFF" strokeWidth="5" strokeLinecap="round" />
        <path
          d="m293 190 27 7m-23 1 27 7m-22 1 27 7"
          stroke="#B39BC9"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="m347 227 18-4 10 8-22 2Z" fill="#B8A1CF" />
        <path d="m271 189 12 10-10 14-13-4" fill="#E0D4EB" />
      </g>
      <circle cx="418" cy="212" r="21" fill="#DBE4C6" />
      <path
        d="M409 193c15 11 20 23 16 38m-27-23c12 1 24-3 32-11"
        stroke="#FBFCF4"
        strokeWidth="2.5"
      />
      <path d="m186 73 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" fill="#B79BCE" />
      <path d="m438 124 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="#B79BCE" />
      <circle cx="228" cy="40" r="4" fill="#D4C3E6" />
      <circle cx="457" cy="173" r="3" fill="#C5B2D6" />
      <g transform="rotate(-8 114 230)">
        <rect x="56" y="213" width="129" height="35" rx="17.5" fill="white" />
        <circle cx="76" cy="230" r="10" fill="#EFE7F6" />
        <path d="m72 230 3 3 5-6" stroke="#977AB5" strokeWidth="1.7" strokeLinecap="round" />
        <text x="94" y="234" fill="#84728F" fontSize="10" fontFamily="sans-serif">
          나의 속도로, 가볍게
        </text>
      </g>
    </svg>
  );
}

type Page = "home" | "schedule" | "data" | "about";
const initialFilters: Filters = {
  field: "전체 분야",
  experience: "상관없음",
  mode: "all",
  sport: "전체 종목",
  days: [],
  start: "06",
  end: "22",
  budget: 100000,
};
const money = (n: number) => n.toLocaleString("ko-KR");
const time = (n: number) =>
  `${String(Math.floor(n)).padStart(2, "0")}:${Math.round((n % 1) * 60)
    .toString()
    .padStart(2, "0")}`;
const sourceUrl = "https://www.data.go.kr/data/15147992/fileData.do";
const videoSourceUrl = "https://www.data.go.kr/data/15119388/fileData.do";

type PublicDataSource = {
  id: string;
  title: string;
  officialName: string;
  provider: string;
  content: string;
  purpose: string;
  url?: string;
  status: string;
  scope: string;
};

// Source descriptions are separate from search records and their provider fields.
const publicDataSources: PublicDataSource[] = [
  {
    id: "olympic-course-records",
    title: "올림픽스포츠센터 강좌정보",
    officialName: "한국체육산업개발주식회사_올림픽스포츠센터 강좌정보_20260601.csv",
    provider: "한국체육산업개발주식회사",
    content:
      "현재 화면은 종목·강좌명·요일·시간·수강월·대상·수강금액 등이 포함된 2026년 강좌 기록 400행을 사용합니다.",
    purpose:
      "관심 분야·세부 조건 탐색, 원본 제목의 입문 표현 안내, 북마크·참고 시간표와 샘플 현황 집계에 활용합니다.",
    status: "2026년 기록 반영 · 원본 관계는 사용자 확인 정보",
    scope:
      "사용자 확인 정보: CP949 원본 2,137행 중 2026년 수강월 기록 400행이며, 원본 13개 필드가 일치합니다. 현재 프로젝트에는 전처리 샘플만 있어 원본 파일 실물·인코딩·전체 행 수·13개 필드 대조를 독립적으로 재검증하지 못했습니다.",
  },
  {
    id: "sports-center",
    title: "스포츠센터 강좌 소개 자료",
    officialName: "한국체육산업개발주식회사_스포츠센터 강좌 정보_20260825",
    provider: "한국체육산업개발주식회사",
    content: "스포츠센터별 강좌명, 강좌 설명, 안내 링크, 등록일·수정일을 제공하는 자료입니다.",
    purpose:
      "센터별 강좌 소개를 확인할 수 있는 별도 참고 출처입니다. 현재 400행 검색 기록의 원본 링크가 아닙니다.",
    url: sourceUrl,
    status: "원본 출처 안내 · 검색 자료와 구분",
    scope: `설명서의 이 포털 파일은 94행 자료로, 현재 검색에 직접 반영되지 않습니다. 오프라인 검색·시간표·집계는 별도로 첨부된 sports_step_search_2026.csv ${courses.length}행 샘플 기준입니다.`,
  },
  {
    id: "online-videos",
    title: "온라인 강습 동영상",
    officialName: "한국체육산업개발주식회사_온라인 강습 동영상_20220629",
    provider: "한국체육산업개발주식회사",
    content: "영상 제목, 등록일, 원본 조회수와 공식 영상 안내 링크 등을 제공하는 자료입니다.",
    purpose: "첨부 영상의 제목·관심분야 검색, 콘텐츠 유형 표시와 공식 영상 링크 안내에 활용합니다.",
    url: videoSourceUrl,
    status: "첨부 샘플 반영",
    scope: `sports_step_videos.csv ${videos.length}행의 메타데이터를 사용합니다. 서비스 전체 자료를 의미하지 않으며, 실제 영상 내용·열람 가능성·강습 여부는 검증되지 않았습니다.`,
  },
];

function App() {
  const bookmarks = useBookmarks();
  const saved = bookmarks.ids;
  const toggleSaved = bookmarks.toggle;
  const [page, setPage] = useState<Page>("home");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Course | null>(null);
  const [videoDetail, setVideoDetail] = useState<Video | null>(null);
  const [courseLimit, setCourseLimit] = useState(COURSE_PAGE_SIZE);
  const [videoLimit, setVideoLimit] = useState(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<ResultSort>("default");
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const navigate = (next: Page) => {
    setPage(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => updateDiscoveryFilter(prev, key, value));
    setCourseLimit(COURSE_PAGE_SIZE);
  };
  const detailOptions = getDetailOptions(filters);
  const discoveryResults = searchDiscovery(
    searched ? applied : { ...initialFilters, budget: Infinity },
    sort,
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (filters.mode !== "online" && +filters.start >= +filters.end) {
      setError("종료시간은 시작시간보다 늦게 선택해 주세요.");
      return;
    }
    setError("");
    setApplied({ ...filters });
    setSearched(true);
    setCourseLimit(COURSE_PAGE_SIZE);
    setVideoLimit(6);
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };
  const selectedCourses = courses.filter((c) => saved.has(c.id));

  return (
    <div className="app">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand-button" onClick={() => navigate("home")} aria-label="무브릿 홈">
            <Brand />
          </button>
          <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label="메인 메뉴">
            {(
              [
                ["home", "운동 찾기"],
                ["schedule", "나의 운동 시간표"],
                ["data", "공공데이터 현황"],
                ["about", "서비스 소개"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={page === key ? "nav-link active" : "nav-link"}
                onClick={() => navigate(key)}
              >
                {label}
                {key === "schedule" && bookmarks.ready && saved.size > 0 && (
                  <span className="nav-count">{saved.size}</span>
                )}
              </button>
            ))}
          </nav>
          <span className="header-caption">당신의 건강한 시작을 함께해요</span>
          <AuthControls />
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </header>

      <main>
        {page === "home" && (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <span className="eyebrow">
                  <svg
                    className="small-spark"
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="m8 0 2.2 5.8L16 8l-5.8 2.2L8 16l-2.2-5.8L0 8l5.8-2.2Z" />
                  </svg>{" "}
                  운동과 조금 더 가까워지는 시간
                </span>
                <h1>
                  무브릿과 함께,
                  <br />
                  <span>나에게 맞는 운동 찾기</span>
                </h1>
                <p>
                  운동의 시작, 나에게 맞는 방향으로.
                  <br />
                  관심 있는 운동부터 시간과 예산까지, 나에게 맞게 찾아보세요.
                </p>
                <div className="hero-note">
                  <span className="tiny-dot" />
                  회원가입 없이, 누구나 가볍게 시작해요
                </div>
              </div>
              <SportsIllustration />
            </section>

            <div className="container">
              <form className="search-panel" onSubmit={submit} ref={searchRef}>
                <div className="search-heading">
                  <div>
                    <h2>어떤 운동을 찾고 계신가요?</h2>
                    <p>나의 일상에 맞는 운동을 찾아보세요.</p>
                  </div>
                  <span className="search-step">
                    <span>01</span> 나에게 맞는 조건 선택
                  </span>
                </div>
                <div className="mode-tabs" role="group" aria-label="이용 형태">
                  {(
                    [
                      { id: "all", label: "모두 보기", icon: "grid" },
                      { id: "offline", label: "오프라인 강좌", icon: "pin" },
                      { id: "online", label: "온라인 영상", icon: "play" },
                    ] as const
                  ).map((mode) => (
                    <button
                      type="button"
                      key={mode.id}
                      className={`mode-tab ${filters.mode === mode.id ? "selected" : ""}`}
                      onClick={() => update("mode", mode.id)}
                      aria-pressed={filters.mode === mode.id}
                    >
                      <Icon name={mode.icon} size={17} />
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="discovery-filter-row">
                  <div className="filter-field">
                    <label htmlFor="interest-field">
                      <Icon name="leaf" size={16} />
                      관심 운동 분야
                    </label>
                    <select
                      id="interest-field"
                      value={filters.field}
                      onChange={(event) => update("field", event.target.value as Filters["field"])}
                    >
                      <option value="전체 분야">전체 분야</option>
                      {interestFields.map((field) => (
                        <option value={field} key={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </div>
                  <fieldset className="filter-field experience-field">
                    <legend>운동 경험은 어느 정도인가요?</legend>
                    <div className="experience-options">
                      {experienceOptions.map((experience) => (
                        <button
                          key={experience}
                          type="button"
                          aria-pressed={filters.experience === experience}
                          className={
                            filters.experience === experience
                              ? "experience-option selected"
                              : "experience-option"
                          }
                          onClick={() => update("experience", experience)}
                        >
                          {experience}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className={`filter-grid ${filters.mode === "online" ? "online-only" : ""}`}>
                  <div className="filter-field sport-field">
                    <label htmlFor="sport">
                      <Icon name="search" size={16} />
                      세부 종목 또는 영상 제목 <span className="optional-label">선택사항</span>
                    </label>
                    <DetailCombobox
                      key={`${filters.field}:${filters.mode}`}
                      id="sport"
                      value={filters.sport}
                      options={detailOptions}
                      onChange={(value) => update("sport", value)}
                    />
                  </div>
                  {filters.mode !== "online" && (
                    <>
                      <fieldset className="filter-field days-field">
                        <legend>
                          <Icon name="calendar" size={16} />
                          운동 가능한 요일 <span>중복 선택</span>
                        </legend>
                        <div className="day-chips">
                          {days.map((day, i) => (
                            <button
                              type="button"
                              key={day}
                              aria-pressed={filters.days.includes(i)}
                              className={filters.days.includes(i) ? "day selected" : "day"}
                              onClick={() =>
                                update(
                                  "days",
                                  filters.days.includes(i)
                                    ? filters.days.filter((d) => d !== i)
                                    : [...filters.days, i],
                                )
                              }
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <div className="filter-field time-field">
                        <label htmlFor="start">
                          <Icon name="clock" size={16} />
                          운동 가능한 시간
                        </label>
                        <div className="time-inputs">
                          <select
                            id="start"
                            value={filters.start}
                            onChange={(e) => update("start", e.target.value)}
                            aria-label="가능 시작시간"
                          >
                            {Array.from({ length: 17 }, (_, i) => `${i + 6}`.padStart(2, "0")).map(
                              (h) => (
                                <option key={h} value={h}>
                                  {h}:00
                                </option>
                              ),
                            )}
                          </select>
                          <span>~</span>
                          <select
                            value={filters.end}
                            onChange={(e) => update("end", e.target.value)}
                            aria-label="가능 종료시간"
                          >
                            {Array.from({ length: 17 }, (_, i) => `${i + 6}`.padStart(2, "0")).map(
                              (h) => (
                                <option key={h} value={h}>
                                  {h}:00
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>
                      <div className="filter-field budget-field">
                        <label htmlFor="budget">
                          <Icon name="wallet" size={16} />
                          최대 수강금액
                        </label>
                        <select
                          id="budget"
                          value={filters.budget}
                          onChange={(e) => update("budget", +e.target.value)}
                        >
                          {[50000, 70000, 100000, 150000, 200000, 500000].map((n) => (
                            <option key={n} value={n}>
                              {money(n)}원 이하
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="search-bottom">
                  <p>
                    <Icon name="info" size={15} />
                    {filters.mode === "online"
                      ? "온라인 영상에는 요일·시간·금액 조건이 적용되지 않아요."
                      : "요일·시간·금액 조건은 오프라인 강좌에만 적용돼요."}
                  </p>
                  <div className="search-actions">
                    <button
                      type="button"
                      className="reset-button"
                      onClick={() => {
                        setFilters(initialFilters);
                        setCourseLimit(COURSE_PAGE_SIZE);
                        setError("");
                      }}
                    >
                      <Icon name="reset" size={15} />
                      초기화
                    </button>
                    <button className="primary-button" type="submit">
                      <Icon name="search" size={18} />내 조건에 맞는 운동 찾기
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </div>
              </form>

              <div className="data-notice">
                <span className="notice-icon">
                  <Icon name="leaf" size={18} />
                </span>
                <p>
                  <strong>공공데이터로 만나는 더 넓은 운동의 세계</strong>
                  <span>
                    첨부된 공개데이터 샘플만 탐색합니다. 서비스 전체 데이터나 현재 모집 정보가
                    아닙니다.
                  </span>
                </p>
                <button onClick={() => navigate("about")}>
                  데이터 알아보기
                  <Icon name="arrow" size={16} />
                </button>
              </div>

              <section className="results-section" ref={resultsRef}>
                {searched && (
                  <div className="filter-summary">
                    <div>
                      <span className="summary-label">선택한 조건</span>
                      <span className="summary-chip">
                        {applied.mode === "all"
                          ? "온라인 + 오프라인"
                          : applied.mode === "offline"
                            ? "오프라인 강좌"
                            : "온라인 영상"}
                      </span>
                      <span className="summary-chip">{applied.sport}</span>
                      <span className="summary-chip">{applied.field}</span>
                      <span className="summary-chip">운동 경험 · {applied.experience}</span>
                      {applied.mode !== "online" && (
                        <>
                          <span className="summary-chip">
                            {applied.days.length
                              ? applied.days.map((d) => days[d]).join("·") + "요일"
                              : "모든 요일"}
                          </span>
                          <span className="summary-chip">
                            {applied.start}:00–{applied.end}:00
                          </span>
                          <span className="summary-chip">최대 {money(applied.budget)}원</span>
                        </>
                      )}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        document.getElementById("sport")?.focus({ preventScroll: true });
                      }}
                    >
                      <Icon name="sliders" size={15} />
                      조건 수정
                    </button>
                  </div>
                )}
                <BookmarkStatus bookmarks={bookmarks} guestNote />
                <DiscoveryResults
                  results={discoveryResults}
                  filters={applied}
                  searched={searched}
                  sort={sort}
                  onSort={(value) => {
                    setSort(value);
                    setCourseLimit(COURSE_PAGE_SIZE);
                  }}
                  courseLimit={courseLimit}
                  videoLimit={videoLimit}
                  onMoreCourses={() => setCourseLimit((limit) => limit + COURSE_LOAD_MORE_SIZE)}
                  onMoreVideos={() => setVideoLimit((limit) => limit + 6)}
                  onReset={() => {
                    setFilters(initialFilters);
                    setCourseLimit(COURSE_PAGE_SIZE);
                    setError("");
                    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  renderCourse={(course, showBeginner) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      showBeginner={showBeginner}
                      saved={bookmarks.ready ? saved.has(course.id) : undefined}
                      saving={bookmarks.pending.has(course.id)}
                      saveError={bookmarks.errors.get(course.id)}
                      onSave={() => toggleSaved(course.id)}
                      onDetail={() => setDetail(course)}
                    />
                  )}
                  renderVideo={(video, index, showBeginner) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      index={index}
                      showBeginner={showBeginner}
                      onClick={() => setVideoDetail(video)}
                    />
                  )}
                />
              </section>
              <section className="bottom-banner">
                <span className="banner-icon">
                  <Icon name="calendar" size={28} />
                </span>
                <div>
                  <h3>내 일상에 운동 한 칸을 더해보세요.</h3>
                  <p>관심 있는 강좌를 담아, 나만의 참고용 운동 시간표를 만들어요.</p>
                </div>
                <button className="secondary-button" onClick={() => navigate("schedule")}>
                  나의 운동 시간표
                  <Icon name="arrow" size={17} />
                </button>
              </section>
            </div>
          </>
        )}

        {page === "schedule" && (
          <div className="container subpage">
            <PageHeading
              eyebrow="MY WEEKLY ROUTINE"
              title="나의 운동 시간표"
              text="나만의 운동 시간표를 만들어 보세요."
            />
            <div className="info-box">
              <Icon name="info" />
              <div>
                <strong>나의 움직임을 미리 그려보는 참고용 시간표예요.</strong>
                <p>
                  공개 데이터에 기록된 요일과 시간으로 구성하며, 실제 수강이나 참여가 확정된 일정이
                  아닙니다. 원본 데이터의 괄호 안 요일은 의미가 확인되지 않아 별도 확인이
                  필요합니다. 괄호 안 요일은 시간표에서 제외하며 기본 표기만 반영합니다. 장시간 검토
                  표시가 있는 기록은 확정된 수업 길이로 해석하지 마세요.
                </p>
              </div>
            </div>
            <div className="schedule-toolbar">
              <div>
                <h2>
                  나의 일주일 <span className="sample-tag">첨부 샘플 · 참고용</span>
                </h2>
                <p>
                  {bookmarks.ready && (
                    <>
                      담은 강좌 {selectedCourses.length}개 ·{" "}
                      {bookmarks.owner
                        ? "계정에 저장돼요."
                        : "비회원은 임시로 담을 수 있어요. 새로고침하거나 브라우저를 닫으면 초기화돼요."}
                    </>
                  )}
                </p>
              </div>
              <button className="secondary-button" onClick={() => navigate("home")}>
                <Icon name="search" size={16} />
                운동 더 찾아보기
              </button>
            </div>
            <BookmarkStatus bookmarks={bookmarks} />
            {bookmarks.ready && bookmarks.unavailableCount > 0 && (
              <p className="section-footnote" role="status">
                현재 강좌 데이터와 연결되지 않는 북마크 {bookmarks.unavailableCount}건은 계정에 보관되어 있어요.
              </p>
            )}
            {selectedCourses.some((a, i) =>
              selectedCourses.some(
                (b, j) =>
                  i < j &&
                  a.days.some((d) => b.days.includes(d)) &&
                  a.start < b.end &&
                  b.start < a.end,
              ),
            ) && (
              <div className="conflict-notice">
                <Icon name="info" size={18} />
                시간이 겹치는 강좌가 있어요. 겹친 일정은 나란히 표시했으니 요일과 시간을 확인해
                주세요.
              </div>
            )}
            <div className="timetable-wrapper" hidden={!bookmarks.ready}>
              <div className="timetable">
                <div className="timetable-top">
                  <span>시간</span>
                  {days.map((d) => (
                    <span key={d}>{d}요일</span>
                  ))}
                </div>
                <div className="timetable-body">
                  <div className="time-labels">
                    {Array.from({ length: 17 }, (_, i) => (
                      <span key={i}>{String(i + 6).padStart(2, "0")}:00</span>
                    ))}
                  </div>
                  {days.map((_, d) => (
                    <div key={d} className="day-column">
                      {Array.from({ length: 16 }, (_, i) => (
                        <div className="hour-cell" key={i} />
                      ))}
                      {selectedCourses
                        .filter((c) => c.days.includes(d))
                        .map((c, i, dayCourses) => {
                          const overlapping = dayCourses.filter(
                            (other) =>
                              other.id !== c.id && c.start < other.end && other.start < c.end,
                          );
                          const offset = overlapping.length
                            ? dayCourses.filter(
                                (other) =>
                                  other.id < c.id && c.start < other.end && other.start < c.end,
                              ).length
                            : 0;
                          return (
                            <button
                              className={`calendar-event event-${i % 3}`}
                              style={{
                                top: `${(c.start - 6) * 64}px`,
                                height: `${Math.max((c.end - c.start) * 64, 52)}px`,
                                width: `calc(${100 / (overlapping.length + 1)}% - 6px)`,
                                left: `calc(${(offset * 100) / (overlapping.length + 1)}% + 3px)`,
                              }}
                              onClick={() => setDetail(c)}
                              key={c.id}
                            >
                              <strong>{c.title}</strong>
                              <span>
                                {time(c.start)}–{time(c.end)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
              {bookmarks.ready && !saved.size && (
                <div className="schedule-empty">
                  <Icon name="calendar" size={32} />
                  <h3>아직 담은 강좌가 없어요.</h3>
                  <p>강좌 카드의 북마크를 눌러 나의 일주일을 채워보세요.</p>
                  <button className="primary-button" onClick={() => navigate("home")}>
                    운동 찾으러 가기
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              )}
            </div>
            {!!selectedCourses.length && (
              <div className="saved-list">
                <h3>담아둔 강좌</h3>
                {selectedCourses.map((c) => (
                  <div key={c.id}>
                    <span>
                      {c.title}{" "}
                      <small>
                        {c.rawDays} · {c.rawTime}
                        {c.parentheticalDays && " · 괄호 요일 확인 필요"}
                      </small>
                    </span>
                    <span>
                      <button
                        className="text-button bookmark-action"
                        disabled={!bookmarks.ready || bookmarks.pending.has(c.id)}
                        aria-busy={bookmarks.pending.has(c.id)}
                        onClick={() => toggleSaved(c.id)}
                      >
                        {bookmarks.pending.has(c.id) ? "해제 중…" : "시간표에서 빼기"}
                        <Icon name="close" size={14} />
                      </button>
                      {bookmarks.errors.has(c.id) && (
                        <small className="bookmark-error" role="alert">{bookmarks.errors.get(c.id)}</small>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {page === "data" && (
          <div className="container subpage">
            <PageHeading
              eyebrow="PUBLIC DATA AT A GLANCE"
              title="공공체육 데이터 현황"
              text="공개 데이터로 살펴보는 우리의 운동, 더 쉽게 한눈에."
            />
            <div className="stats-grid">
              {[
                {
                  label: "첨부 샘플 · 오프라인 강좌 기록",
                  value: String(courses.length),
                  unit: "건",
                  note: "2026년 수강월 기준",
                  icon: "calendar",
                },
                {
                  label: "공공기관 온라인 영상 메타데이터",
                  value: String(videos.length),
                  unit: "건",
                  note: "강습 여부 검토 전",
                  icon: "play",
                },
                {
                  label: "첨부 샘플 · 오프라인 종목 분류",
                  value: String(new Set(courses.map((course) => course.sport)).size),
                  unit: "개",
                  note: "미기재 포함",
                  icon: "grid",
                },
              ].map((s) => (
                <div className="stat-card" key={s.label}>
                  <p>{s.label}</p>
                  <div className="stat-value">
                    <span className="stat-icon" aria-hidden="true">
                      <Icon name={s.icon as IconName} size={23} />
                    </span>
                    <strong>
                      {s.value}
                      <span>{s.unit}</span>
                    </strong>
                  </div>
                  <small>{s.note}</small>
                </div>
              ))}
            </div>
            <p className="section-footnote">
              <Icon name="play" size={16} />
              외부 YouTube 영상 {externalVideos.length}건은 아래 공공데이터 통계와 별도로 집계합니다.
            </p>
            <section
              className="info-box course-eligibility-summary"
              aria-label="강좌 탐색 대상과 기본 제외 기준"
            >
              <Icon name="info" />
              <div>
                <strong>
                  원본 {courses.length}건 보존 · 일반 강좌 탐색 대상 {searchableCourses.length}건 ·
                  기본 제외 {excludedCourses.length}건
                </strong>
                <p>
                  아래 그래프는 제외 기록도 포함한 원본 전체 샘플 기준입니다. 검색 결과는 탐색
                  대상에서 선택한 조건에 일치하는 기록만 표시합니다. ‘자유이용’ 같은 제목만으로 시설
                  이용권이라고 확정하지 않으며, 종목이 확인되는 자율이용·방학특강은 일괄 제외하지
                  않습니다.
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
                  그래프는 첨부 CSV의 실제 기록을 집계합니다. 요일은 기본 표기만 반영하고 괄호 안
                  요일은 제외합니다. 여러 요일의 강좌는 각 요일에 중복 집계되며, 종목 그래프는 상위
                  5개 외 종목을 기타로 묶었습니다. 현재 운영 현황이나 수요를 뜻하지 않습니다.
                </p>
              </div>
            </div>
            <div className="charts-grid">
              {sampleCharts.map((chart) => (
                <BarChart key={chart.title} {...chart} />
              ))}
            </div>
            <section className="discovery-analytics">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">CONTENT EXPLORATION</span>
                  <h2>관심 분야와 입문 표현으로 살펴보기</h2>
                  <p>
                    현재 400건 강좌·56건 영상의 원본 기록만 집계합니다. 검색 결과 수와는 별개인 전체
                    첨부 샘플 기준입니다.
                  </p>
                </div>
              </div>
              <div className="charts-grid">
                <DiscoveryAnalysis />
                <div className="beginner-analysis">
                  <BarChart {...beginnerChart} />
                  <div className="info-box">
                    <Icon name="info" size={18} />
                    <div>
                      <strong>원본 문구의 확인 결과이지, 난이도 인증이 아닙니다.</strong>
                      <p>
                        입문·초급·기초·Beginner를 제목에서 판별합니다. ‘기초체력’, ‘기초대사량’,
                        ‘초.중급’처럼 의미가 다른 표현은 입문으로 판정하지 않습니다. ‘검토 필요’
                        영상의 분야도 임의로 추정하지 않습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <Limitations />
          </div>
        )}

        {page === "about" && (
          <div className="container subpage about-page">
            <PageHeading
              eyebrow="A SMALL STEP, A HEALTHIER DAY"
              title="운동의 시작이 조금 더 쉬워지도록"
              text="무브릿은 당신과 운동 사이의 거리를 좁힙니다."
            />
            <section className="about-intro">
              <span className="about-icon">
                <Icon name="leaf" size={36} />
              </span>
              <h2>
                운동의 시작,
                <br />
                나에게 맞는 방향으로.
              </h2>
              <p>
                무브릿은 운동을 처음 시작하는 이용자가 관심 운동 분야와 경험 수준에 따라
                <br className="desktop-break" /> 공공체육 강좌정보와 온라인 콘텐츠를 탐색할 수
                있도록 돕는 서비스입니다.
                <br />
                회원가입이나 개인정보 입력 없이 누구나 이용할 수 있어요.
              </p>
            </section>
            <section className="about-features">
              <h2>이렇게 운동의 시작을 도와드려요.</h2>
              <ol>
                {[
                  "종목명을 몰라도 관심 운동 분야부터 탐색",
                  "운동 경험 선택과 원본 제목의 입문 관련 표현 우선 안내",
                  "같은 분야의 온라인 콘텐츠와 오프라인 강좌를 독립적으로 탐색",
                  "관심 강좌 북마크와 참고용 주간 운동 시간표",
                  "첨부 공공체육 콘텐츠의 분야별 제공 현황 시각화",
                ].map((feature, index) => (
                  <li key={feature}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {feature}
                  </li>
                ))}
              </ol>
              <p>
                원본 표현을 우선 안내할 뿐 실제 난이도·초보자 적합성이나 안전성을 보장하지 않습니다.
                수강 신청·의학적 운동 처방 기능은 제공하지 않습니다.
              </p>
            </section>
            <details className="mapping-guide">
              <summary>관심 분야 분류와 입문 표현 판별 기준</summary>
              <p>
                강좌는 종목을 우선 확인하고, 근거가 없으면 원본 강좌명의 명시적 키워드를 확인합니다.
                ‘헬스등록필수’ 같은 이용 조건은 종목 근거에서 제외합니다. 영상은 첨부 CSV의
                관심분야를 사용하며, 검토 상태나 운동 외 분류를 임의로 바꾸지 않습니다.
              </p>
              <dl>
                {fieldRules.map((rule) => (
                  <div key={rule.field}>
                    <dt>{rule.field}</dt>
                    <dd>{rule.terms.join(" · ")} — 원본에서 실제 확인되는 경우에만 연결</dd>
                  </div>
                ))}
              </dl>
              <p>
                현재 샘플에는 설명 필드가 없어 원본 강좌명·영상 제목만 분석합니다.
                입문·초급·기초·Beginner를 확인하되 기초체력·기초대사량·혼합 수준 표기는 제외합니다.
                분류되지 않은 기록은 ‘기타 운동’으로 몰아넣지 않고 ‘분류 확인 필요’로 별도
                집계합니다.
              </p>
            </details>
            <h2 className="about-section-title">공개된 데이터를, 알기 쉬운 정보로</h2>
            <p className="source-context">
              데이터 제공기관과 등록 플랫폼을 구분해 안내합니다. 공공데이터포털은 자료가 등록된
              플랫폼이며, 아래 제공기관이 원본 자료를 공개합니다. 실제 화면 반영 범위는 각 카드에서
              확인해 주세요.
            </p>
            <div className="source-grid">
              {publicDataSources.map((source) => (
                <DataSourceCard key={source.id} source={source} />
              ))}
            </div>
            <Limitations />
            <div className="privacy-note">
              <Icon name="check" size={20} />
              <div>
                <h3>개인정보 없이, 가볍게 이용하세요.</h3>
                <p>
                  회원가입이 필요하지 않으며, 선택한 조건과 관심 강좌는 현재 열린 화면에서만
                  사용됩니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <button className="brand-button" onClick={() => navigate("home")}>
              <Brand small />
            </button>
            <p>운동의 시작, 나에게 맞는 방향으로.</p>
            <small>© 2026 MOVEBRIDGE. 공공데이터 활용 서비스</small>
          </div>
          <div className="footer-right">
            <div>
              <button onClick={() => navigate("about")}>서비스 소개</button>
              <button onClick={() => navigate("about")}>
                공공데이터 출처
                <Icon name="external" size={12} />
              </button>
            </div>
            <p>
              데이터 제공 · 한국체육산업개발(주)
              <br />
              공개 기록은 현재 운영·모집 여부를 보장하지 않습니다.
            </p>
            <span className="footer-badge">
              <span className="tiny-dot" />
              작은 시작이 만드는 건강한 일상
            </span>
          </div>
        </div>
      </footer>

      {(detail || videoDetail) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setDetail(null);
            setVideoDetail(null);
          }}
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            ref={(node) => node?.focus()}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDetail(null);
                setVideoDetail(null);
              }
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
                const first = items[0];
                const last = items[items.length - 1];
                if (
                  e.shiftKey &&
                  (document.activeElement === first || document.activeElement === e.currentTarget)
                ) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="상세 정보 닫기"
              onClick={() => {
                setDetail(null);
                setVideoDetail(null);
              }}
            >
              <Icon name="close" />
            </button>
            <span className="sample-tag">
              {videoDetail?.source === "youtube" ? "외부 YouTube" : "첨부 공공데이터 샘플 · 전체 자료 아님"}
            </span>
            {detail ? (
              <div className="course-detail-heading">
                <span className="sport-pictogram-box sport-pictogram-box-detail">
                  <SportPictogram icon={getCourseDisplay(detail).pictogramKey} size={36} />
                </span>
                <h2 id="modal-title">{getCourseDisplay(detail).displayTitle}</h2>
              </div>
            ) : (
              <h2 id="modal-title">{videoDetail?.title}</h2>
            )}
            {detail ? (
              <>
                <dl className="detail-list">
                  <div>
                    <dt>CSV 원본 강좌명</dt>
                    <dd className="course-raw-title">{detail.title}</dd>
                  </div>
                  <div>
                    <dt>이용 대상·조건</dt>
                    <dd>
                      {getCourseDisplay(detail).displayTags.length ? (
                        <div className="course-detail-tags">
                          {getCourseDisplay(detail).displayTags.map((tag) => (
                            <span className="course-condition-tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "원본에 별도 표기 없음"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>운동 종목</dt>
                    <dd>
                      {getCourseDisplay(detail).displaySport}
                      {getCourseDisplay(detail).sportResolutionStatus === "inferred" && " (추정)"}
                    </dd>
                  </div>
                  <div>
                    <dt>운동 종목 원본 필드</dt>
                    <dd>{detail.sport}</dd>
                  </div>
                  <div>
                    <dt>표시 종목 확인 근거</dt>
                    <dd>
                      {getCourseDisplay(detail).sportResolutionStatus === "inferred"
                        ? `원본 명칭에 따른 종목 추정: ${getCourseDisplay(detail).sportResolutionEvidence}`
                        : getCourseDisplay(detail).sportResolutionStatus === "title"
                          ? "원본 강좌명에 명시된 종목·세부 명칭을 표시했습니다. 원본 종목 필드는 변경하지 않았습니다."
                          : getCourseDisplay(detail).sportResolutionStatus === "unresolved"
                            ? "종목을 확정하지 않았습니다. 원본 표기를 유지하며 추가 확인이 필요합니다."
                            : "원본 종목 필드를 기준으로 기본 종목명을 표시했습니다."}
                    </dd>
                  </div>
                  {getCourseDisplay(detail).instructors.length > 0 && (
                    <div>
                      <dt>강사명 (원본 표기)</dt>
                      <dd>{getCourseDisplay(detail).instructors.join(" · ")}</dd>
                    </div>
                  )}
                  <div>
                  <dt>
                    {getCourseDisplay(detail).additionalTypes.includes("방학특강")
                      ? "프로그램 유형"
                      : "추출한 추가 유형"}
                  </dt>
                    <dd>
                      {getCourseDisplay(detail).additionalTypes.join(" · ") ||
                        "별도 유형 표기 확인 안 됨"}
                    </dd>
                  </div>
                  {getCourseDisplay(detail).packageDetails.length > 0 && (
                    <div>
                      <dt>패키지 구성 (원본)</dt>
                      <dd>{getCourseDisplay(detail).packageDetails.join(" · ")}</dd>
                    </div>
                  )}
                  <div>
                    <dt>원본 기타 설명</dt>
                    <dd>
                      별도 설명 필드가 없습니다. 분리하지 않은 문구는 위 CSV 원본 강좌명 전체에서
                      확인해 주세요.
                    </dd>
                  </div>
                  <div>
                    <dt>수강요일</dt>
                    <dd>
                      {detail.rawDays}
                      {detail.parentheticalDays && (
                        <small className="field-caution">
                          괄호 요일 ({detail.parentheticalDays}) · 의미 확인 필요
                        </small>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>수강시간</dt>
                    <dd>
                      {detail.rawTime}
                      {detail.longTimeReview && (
                        <small className="field-caution">
                          원본 장시간 검토 표시 · 시간 확인 필요
                        </small>
                      )}
                      {getCourseDisplay(detail).timeConflicts.length > 0 && (
                        <small className="field-caution">
                          제목의 시간 표기: {getCourseDisplay(detail).timeConflicts.join(" · ")}.
                          표시용 제목은 수강시간 필드를 우선합니다.
                        </small>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>공개 데이터 수강금액</dt>
                    <dd>{money(detail.price)}원</dd>
                  </div>
                  <div>
                    <dt>수강월</dt>
                    <dd>{detail.month}</dd>
                  </div>
                  <div>
                    <dt>수강대상 원본 필드</dt>
                    <dd>{detail.audience}</dd>
                  </div>
                  <div>
                    <dt>원본 데이터 출처</dt>
                    <dd>
                      한국체육산업개발(주)
                      <br />
                      올림픽스포츠센터 강좌정보
                    </dd>
                  </div>
                </dl>
                <div className="modal-note">
                  <Icon name="info" size={18} />
                  <p>
                    시설 주소·센터명·신청 URL·모집 상태는 제공되지 않습니다. 수강금액의 결제 주기,
                    일정 및 괄호 안 요일의 의미는 별도 확인이 필요합니다. 대상·조건 라벨은 원본
                    강좌명 또는 수강대상 필드의 표기이며, 현재 적용 중인 이용 규정이나 등록 가능
                    여부를 확인한 것이 아닙니다. ‘초급’ 등 수준 표현도 원본 명칭일 뿐, 실제 난이도나
                    초보자 적합성을 보장하지 않습니다.
                    {getCourseDisplay(detail).needsReview &&
                      " 일부 종목·요일·시간은 추가 확인이 필요합니다. 추정하지 않은 원본 표현은 위 CSV 원본 강좌명과 원본 필드에서 확인해 주세요."}
                  </p>
                </div>
                <BookmarkStatus bookmarks={bookmarks} guestNote />
                <button
                  className="primary-button full-width bookmark-action"
                  disabled={!bookmarks.ready || bookmarks.pending.has(detail.id)}
                  aria-busy={bookmarks.pending.has(detail.id)}
                  onClick={() => toggleSaved(detail.id)}
                >
                  <Icon name={saved.has(detail.id) ? "check" : "bookmark"} size={18} />
                  {bookmarks.pending.has(detail.id)
                    ? saved.has(detail.id) ? "해제 중…" : "저장 중…"
                    : saved.has(detail.id)
                      ? "시간표에 담았어요 · 다시 눌러 해제"
                      : "나의 참고 시간표에 담기"}
                </button>
                {bookmarks.errors.has(detail.id) && (
                  <p className="bookmark-error" role="alert">{bookmarks.errors.get(detail.id)}</p>
                )}
              </>
            ) : videoDetail?.source === "youtube" ? (
              <>
                <dl className="detail-list">
                  {[
                    ["채널", videoDetail.channel],
                    ["관심 운동 분야", videoDetail.sport],
                    ["세부 종목", videoDetail.discipline],
                    ["표본 난이도", videoDetail.difficulty],
                    ["난이도 신뢰도", videoDetail.confidence],
                    ["추천 운동 경험 (표본 기준)", videoDetail.experience],
                    ["실제 확인 구간", videoDetail.observedRange],
                    ["난이도 판단 근거", videoDetail.difficultyEvidence],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="modal-note">
                  제공된 검증 기록에서 확인한 표본 구간의 판단입니다. 영상 전체의 공식 난이도나
                  개인별 운동 적합성을 보장하지 않습니다.
                </p>
                <a
                  className="primary-button full-width"
                  href={videoDetail.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube 원본 영상 열기
                  <Icon name="external" size={16} />
                </a>
              </>
            ) : (
              <>
                <div className="modal-video">
                  <Icon name="play" size={42} />
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>관심 운동 분야</dt>
                    <dd>{videoDetail?.sport}</dd>
                  </div>
                  <div>
                    <dt>영상 등록일</dt>
                    <dd>{videoDetail?.date}</dd>
                  </div>
                  <div>
                    <dt>콘텐츠 유형</dt>
                    <dd>{videoDetail?.type}</dd>
                  </div>
                  <div>
                    <dt>공식 영상 링크</dt>
                    <dd>
                      <a
                        className="text-button"
                        href={videoDetail?.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        공식 영상 안내 페이지
                        <Icon name="external" size={13} />
                      </a>
                    </dd>
                  </div>
                </dl>
                <p className="modal-note">
                  첨부 CSV에 수록된 원본 정보입니다. 콘텐츠 유형은 1차 검토 상태이며 ‘미검토’는 강습
                  확인 완료를 뜻하지 않습니다. 실제 열람 가능성과 영상 내용은 검증되지 않았고, 특정
                  오프라인 강좌와 연결되지 않습니다.
                </p>
                <a
                  className="primary-button full-width"
                  href={videoDetail?.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  공식 영상 안내 페이지 열기
                  <Icon name="external" size={16} />
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function BookmarkStatus({
  bookmarks, guestNote = false,
}: {
  bookmarks: ReturnType<typeof useBookmarks>;
  guestNote?: boolean;
}) {
  if (bookmarks.loading)
    return <p className="section-footnote" role="status">저장된 강좌를 불러오는 중이에요.</p>;
  if (bookmarks.status === "error")
    return (
      <div className="section-footnote">
        <p role="alert">저장된 강좌를 불러오지 못했어요.</p>
        <button className="text-button" onClick={bookmarks.retry}>다시 불러오기</button>
      </div>
    );
  if (guestNote && !bookmarks.owner)
    return <p className="section-footnote">비회원 북마크는 이 탭을 새로고침하거나 닫기 전까지 유지돼요. 계정에 저장하려면 로그인해 주세요.</p>;
  return null;
}

function CourseCard({
  course,
  showBeginner = false,
  saved,
  saving,
  saveError,
  onSave,
  onDetail,
}: {
  course: Course;
  showBeginner?: boolean;
  saved: boolean | undefined;
  saving: boolean;
  saveError?: string;
  onSave: () => void;
  onDetail: () => void;
}) {
  const { displayTitle, displayTags, pictogramKey, sportResolutionStatus, additionalTypes } =
    getCourseDisplay(course);
  return (
    <article className="course-card">
      <div className="course-top">
        <div className="course-labels">
          <span className="offline-label">오프라인 강좌</span>
          {displayTags.map((tag) => (
            <span className="course-condition-tag" key={tag}>
              {tag}
            </span>
          ))}
          {additionalTypes.includes("방학특강") && (
            <span className="course-condition-tag">방학특강</span>
          )}
          {sportResolutionStatus === "inferred" && (
            <span
              className="course-condition-tag"
              title="원본 명칭에 따른 종목 추정이며 공식 약어 해석은 확인되지 않았습니다."
            >
              종목 추정
            </span>
          )}
          {showBeginner && <BeginnerLabel title={course.title} />}
        </div>
        <button
          className={`bookmark-button bookmark-action ${saved ? "is-saved" : ""}`}
          onClick={onSave}
          disabled={saving || saved === undefined}
          aria-busy={saving}
          aria-label={`${course.title} ${saving ? "북마크 처리 중" : saved ? "관심 해제" : "관심 표시"}`}
          aria-pressed={saved}
        >
          <Icon name="bookmark" size={20} />
        </button>
      </div>
      {saveError && <p className="bookmark-error" role="alert">{saveError}</p>}
      <div className="course-title-row">
        <span className="sport-pictogram-box">
          <SportPictogram icon={pictogramKey} size={32} />
        </span>
        <button className="course-title" onClick={onDetail} title={displayTitle}>
          {displayTitle}
        </button>
      </div>
      <div className="course-schedule">
        <p className="course-weekdays">
          <Icon name="calendar" size={15} />
          <span>{course.rawDays}</span>
        </p>
        <p className="course-time">
          <Icon name="clock" size={15} />
          <span>{course.rawTime}</span>
        </p>
      </div>
      <div className="course-meta">
        <p className="course-details">
          <Icon name="grid" size={15} />
          <span>{course.month}</span>
          <span className="meta-divider" />
          <span>{course.audience}</span>
        </p>
        <div className="course-cautions">
          {course.parentheticalDays && (
            <p className="course-caution">
              <Icon name="info" size={12} />
              괄호 요일 의미 확인 필요
            </p>
          )}
          {course.longTimeReview && (
            <p className="course-caution">
              <Icon name="info" size={12} />
              수강시간 확인 필요
            </p>
          )}
        </div>
      </div>
      <div className="course-price">
        <span>공개 데이터 수강금액</span>
        <strong>
          {money(course.price)}
          <small>원</small>
        </strong>
      </div>
      <div className="course-source">
        <p>
          데이터 출처 · 한국체육산업개발(주)
          <span>첨부 샘플 · 현재 운영·모집 및 일정 확인 필요</span>
        </p>
        <button className="round-arrow" onClick={onDetail} aria-label={`${course.title} 상세 보기`}>
          <Icon name="arrow" size={17} />
        </button>
      </div>
    </article>
  );
}

function DataSourceCard({ source }: { source: PublicDataSource }) {
  return (
    <section className="source-card" aria-labelledby={`source-${source.id}`}>
      <span className="source-label">제공기관 · {source.provider}</span>
      <h3 id={`source-${source.id}`}>{source.title}</h3>
      <dl className="source-details">
        <div>
          <dt>공식 데이터셋명</dt>
          <dd className="source-official-name">{source.officialName}</dd>
        </div>
        <div>
          <dt>주요 내용</dt>
          <dd>{source.content}</dd>
        </div>
        <div>
          <dt>무브릿에서의 활용</dt>
          <dd>{source.purpose}</dd>
        </div>
      </dl>
      <div className="source-application">
        <strong>{source.status}</strong>
        <p>{source.scope}</p>
      </div>
      {source.url ? (
        <a
          className="text-button"
          href={source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${source.title} 공공데이터포털 원본 보기`}
        >
          공공데이터포털 원본 보기
          <Icon name="external" size={15} />
        </a>
      ) : (
        <p className="source-link-pending">
          공식 공공데이터포털 링크 미확인 · 원본 CSV 실물은 프로젝트에 미첨부
        </p>
      )}
    </section>
  );
}

function VideoCard({
  video,
  index,
  onClick,
  showBeginner = false,
}: {
  video: Video;
  index: number;
  onClick: () => void;
  showBeginner?: boolean;
}) {
  const external = video.source === "youtube" ? video : null;
  return (
    <article className="video-card">
      <button
        className={`video-thumbnail thumbnail-${index}`}
        onClick={onClick}
        aria-label={`${video.title} 정보 보기`}
      >
        {external && (
          <img
            className="absolute inset-0 h-full w-full object-contain"
            src={external.thumbnail}
            alt=""
            loading="lazy"
          />
        )}
        <span className="video-category">{video.sport}</span>
        {!external && (
          <>
            <span className="thumbnail-ring ring-one" />
            <span className="thumbnail-ring ring-two" />
          </>
        )}
        <span className="video-play">
          <Icon name="play" size={24} />
        </span>
        {!external && (
          <>
            <span className="thumbnail-caption">공개 영상 메타데이터</span>
            <span className="thumbnail-example">일반 이미지 · 실제 영상 캡처 아님</span>
          </>
        )}
      </button>
      <div className="video-card-body">
        <div className="video-tags">
          <span>{video.sport}</span>
          {video.source === "youtube" ? (
            <>
              <span>{video.discipline}</span>
              <span>외부 YouTube</span>
            </>
          ) : (
            <>
              <span>{video.type}</span>
              <span>공공기관</span>
              {showBeginner && <BeginnerLabel title={video.title} />}
            </>
          )}
        </div>
        <button className="video-title" onClick={onClick}>
          {video.title}
        </button>
        {video.source === "youtube" ? (
          <>
            <p>{video.channel}</p>
            <p>표본 난이도 {video.difficulty} · 신뢰도 {video.confidence}</p>
          </>
        ) : (
          <p>등록일 {video.date}</p>
        )}
        <button className="video-detail-link" onClick={onClick}>
          영상 정보 확인
          <Icon name="arrow" size={14} />
        </button>
        <a className="video-detail-link" href={video.url} target="_blank" rel="noreferrer">
          {external ? "YouTube 원본 영상" : "공식 영상 링크"}
          <Icon name="external" size={13} />
        </a>
      </div>
    </article>
  );
}
function BeginnerLabel({ title }: { title: string }) {
  const { beginnerMatchedTerms } = analyzeBeginnerTitle(title);
  return beginnerMatchedTerms.length ? (
    <span
      className="beginner-label"
      title="원본 제목에서 확인한 표현이며, 공식 난이도나 초보자 적합성을 보장하지 않습니다."
    >
      원본 제목에 ‘{beginnerMatchedTerms.join("·")}’ 표기
    </span>
  ) : null;
}
function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-heading">
      <span className="section-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function BarChart({
  title,
  labels,
  values,
}: {
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
      <div className="bar-chart">
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
      <span className="chart-note">첨부 CSV 기준 · 현재 운영·모집 여부와 무관합니다.</span>
    </section>
  );
}
function Limitations() {
  return (
    <section className="limitations">
      <h3>
        <Icon name="info" size={19} />
        데이터를 이해할 때, 꼭 확인해 주세요.
      </h3>
      <ul>
        <li>
          첨부 샘플의 오프라인 {courses.length}건은 2026년 수강월 기준 기록으로, 현재 운영 또는 모집
          중이라는 의미가 아닙니다.
        </li>
        <li>시설 주소, 센터명, 신청 URL, 모집 상태는 포함되어 있지 않습니다.</li>
        <li>수강금액의 결제 주기와 원본 데이터의 괄호 안 요일은 정확한 의미 확인이 필요합니다.</li>
        <li>
          첨부 샘플의 온라인 영상 {videos.length}건 모두가 실제 강습 영상으로 검증된 것은 아니며,
          난이도나 초보자 적합성을 보장하지 않습니다.
        </li>
        <li>
          온·오프라인 간 동일 강좌 식별정보가 없어 개별 강좌와 영상을 1:1로 연결하지 않습니다.
        </li>
        <li>
          첨부 자료는 UI·레이아웃 검토용 샘플입니다. 검색 결과와 집계는 샘플 범위로 한정되며, 서비스
          전체 데이터로 해석할 수 없습니다.
        </li>
      </ul>
    </section>
  );
}
export default App;
