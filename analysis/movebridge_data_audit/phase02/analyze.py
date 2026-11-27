"""Classify historical courses and compare sport/topic coverage without changing app data."""

import argparse
import csv
import hashlib
import json
import platform
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
from publication import SERVICE_BASE, course_text_redactor, public_csv_row, public_value

SOURCE = ROOT / "Frontend/data/original"
PHASE1 = HERE.parent / "phase01/results_2026-11-25"
UNRESOLVED = "분류 확인 필요"
NON_SPORT = "운동 외 콘텐츠"
CONFIRMED, INFERRED, REVIEW, HISTORICAL = "근거 확인", "추정", UNRESOLVED, "과거 신규 원본 종목 검토"
VIDEO_EXCLUDED_TYPES = re.compile("접수·신청|행사 후보|예고·홍보")
EXTERNAL_ALIASES = {"줌바": "줌바댄스"}
FILES = ("classified_courses.csv", "content_coverage.csv", "summary.json")


def read_csv(path, encoding="utf-8-sig"):
    with path.open(encoding=encoding, newline="") as stream:
        return list(csv.DictReader(stream, strict=True))


def write_csv(path, rows, redact):
    with path.open("x", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(public_csv_row(row, redact) for row in rows)


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def percentage(numerator, denominator):
    return round(100 * numerator / denominator, 4) if denominator else None


def counted(rows, predicate):
    return sum(bool(predicate(row)) for row in rows)


def title_terms(title):
    korean = [term for term in ("입문", "처음", "초급", "기초") if term in title]
    return korean + (["Beginner"] if re.search(r"\bBeginner\b", title, re.I | re.ASCII) else [])


def run_rules(raw, videos, external):
    script = r"""
import { classifyAnalysisCourse, classifyAnalysisVideo, discoveryDistribution } from './Frontend/src/data/public-data-analysis.ts';
import { analyzeBeginnerTitle, classifyCourse } from './Frontend/src/data/discovery.ts';
import { courses, searchableCourses } from './Frontend/src/data/search.ts';
import { getCourseDisplay } from './Frontend/src/data/course-display.ts';
import { roadmapResults, initialRoadmap } from './Frontend/src/features/onboarding/roadmap.ts';
import { scheduleEntries } from './Frontend/src/features/workout-planner/planner-model.ts';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
const { raw, videos, external } = JSON.parse(input);
const courseRows = Object.fromEntries(raw.map(({ id, title, sport }) => [
  id, { ...classifyAnalysisCourse({ title, sport }), beginner: analyzeBeginnerTitle(title).beginnerMatchedTerms }
]));
const videoRows = Object.fromEntries(videos.map(row => [row.순번, {
  ...classifyAnalysisVideo(row), beginner: analyzeBeginnerTitle(row.제목).beginnerMatchedTerms,
}]));
const externalTitleTerms = Object.fromEntries(external.map(row =>
  [row.id, analyzeBeginnerTitle(row.title).beginnerMatchedTerms]
));
const searchField = Object.fromEntries(courses.map(row => [row.id, classifyCourse(row).field]));
const timeConflicts = Object.fromEntries(courses.flatMap(row => {
  const { timeConflicts } = getCourseDisplay(row);
  return timeConflicts.length ? [[row.id, timeConflicts]] : [];
}));
const paused = courses.filter(row => row.title.includes('일시중지'));
const projections = scheduleEntries(paused, []);
console.log(JSON.stringify({
  courseRows, videoRows, externalTitleTerms, searchField, timeConflicts,
  eligible: searchableCourses.map(row => String(row.id)),
  roadmapCourses: roadmapResults(initialRoadmap).courses.map(({record}) => String(record.id)),
  pausedProjectionCount: projections.length,
  fields: discoveryDistribution.map(row => row.field),
}));
"""
    data = dict(raw=[dict(id=r["일련번호"], title=r["강좌명"], sport=r["종목"]) for r in raw],
                videos=videos, external=[dict(id=r["id"], title=r["영상제목"]) for r in external])
    node = ["node", "--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script]
    return json.loads(subprocess.check_output(node, cwd=ROOT, input=json.dumps(data), text=True))


def classify_history(raw, service, rules, audited_time, cutoff):
    sports_seen = {row["종목"] for row in service}
    service_ids = {row["일련번호"] for row in service}
    search_ids = set(rules["eligible"])
    analysis_rows = []
    for raw_row in raw:
        id_ = raw_row["일련번호"]
        year = date.fromisoformat(raw_row["수강월"]).year
        candidate = rules["courseRows"][id_]
        raw_sport = raw_row["종목"]
        new_label = bool(raw_sport.strip() and raw_sport not in sports_seen)
        field = candidate["field"]
        sport = candidate["sport"] or ""
        status = INFERRED if candidate.get("inferred") else CONFIRMED if sport else REVIEW
        reason = candidate["evidence"]
        if new_label:
            field, sport, status = UNRESOLVED, "", HISTORICAL
            reason = "2026년 원본에 없는 종목 표기. 기존 함수의 후보와 원본의 충돌 여부를 별도 검토."
        declared_end = raw_row["수강종료일"]
        end_status = ("특수 종료일" if declared_end == "9999-12-31" else
                      "일반 종료일 경과" if date.fromisoformat(declared_end) < cutoff else "일반 종료일 미경과")
        analysis_rows.append({
            **raw_row,
            "수강월_연도": year,
            "서비스_400": id_ in service_ids,
            "기본검색_399": id_ in search_ids,
            "기존_검색_분야": rules["searchField"].get(id_, ""),
            "분석_상위_운동_분야": field,
            "표준_세부_종목": sport,
            "분류_상태": status,
            "분류_근거": reason,
            "과거_전용_원본_종목": new_label,
            "기존_함수_분야_후보": candidate["field"],
            "기존_함수_세부종목_후보": candidate["sport"] or "",
            "기존_함수_근거": candidate["evidence"],
            "제목_일시중지_표기": "일시중지" in raw_row["강좌명"],
            "운영_확인_상태": "현재 운영·모집 미확인",
            "기록_종료일_상태": end_status,
            "Phase1_제목_시간_검토": audited_time.get(id_, ""),
            "서비스_화면_시간_충돌_후보": " | ".join(rules["timeConflicts"].get(id_, [])),
            "제목_입문_표현": " | ".join(title_terms(raw_row["강좌명"])),
            "서비스_입문_표현_규칙": " | ".join(candidate["beginner"]),
        })
    return analysis_rows


def make_content(classified, institutions, external, rules):
    courses = []
    videos = []
    for row in classified:
        if not row["서비스_400"]:
            continue
        courses.append(dict(
            source="course", id=row["일련번호"], field=row["분석_상위_운동_분야"], sport=row["표준_세부_종목"],
            status=row["분류_상태"], searchable=row["기본검색_399"],
            paused=row["제목_일시중지_표기"], title_intro=bool(row["제목_입문_표현"]),
            app_intro=bool(row["서비스_입문_표현_규칙"]),
        ))
    for row in institutions:
        result = rules["videoRows"][row["순번"]]
        field = result["field"]
        sport = result["sport"] or ""
        candidate = bool(VIDEO_EXCLUDED_TYPES.search(row["콘텐츠유형"]))
        status = field if field in {NON_SPORT, UNRESOLVED} else CONFIRMED if sport else "상위 분야만 확인"
        videos.append(dict(
            source="institution", id=row["순번"], field=field, sport=sport, provided_sport=sport,
            status=status, eligible=field not in {NON_SPORT, UNRESOLVED} and not candidate,
            flagged_type=candidate, title_intro=bool(title_terms(row["제목"])),
            app_intro=bool(result["beginner"]), sample_intro=False, sample_level=None,
        ))
    for row in external:
        sport = row["세부종목"]
        videos.append(dict(
            source="external", id=row["id"], field=row["관심분야"], sport=EXTERNAL_ALIASES.get(sport, sport),
            provided_sport=sport, status="외부 검증 CSV 표기", eligible=bool(row["관심분야"]),
            flagged_type=False, title_intro=bool(title_terms(row["영상제목"])),
            app_intro=bool(rules["externalTitleTerms"][row["id"]]),
            sample_intro=row["추천운동경험"] == "입문·기초", sample_level=row["추천운동경험"],
        ))
    return courses, videos


def coverage_table(courses, videos, field_order):
    grouped = defaultdict(list)
    for row in courses + videos:
        grouped[row["field"]].append(row)

    def summarize(rows, field, sport, level, field_videos):
        course = [r for r in rows if r["source"] == "course"]
        searchable = [r for r in course if r["searchable"]]
        public = [r for r in rows if r["source"] == "institution"]
        external = [r for r in rows if r["source"] == "external"]
        p_ok = [r for r in public if r["eligible"]]
        e_ok = [r for r in external if r["eligible"]]
        # A field-level count includes all eligible records in that field. On detail rows,
        # related-field counts exclude equal canonical detail, and may include field-only videos.
        fallback = [r for r in field_videos if r["eligible"] and r["sport"] != sport]
        known = level == "sport" and bool(sport) and any(r["status"] == CONFIRMED for r in searchable)
        return dict(
            level=level, field=field, detail_sport=sport, confirmed_search_sport=known,
            course_records=len(course), searchable_course_records=len(searchable),
            confirmed_search_records=counted(searchable, lambda r: r["status"] == CONFIRMED),
            inferred_course_records=counted(course, lambda r: r["status"] == INFERRED),
            review_course_records=counted(course, lambda r: r["status"] == REVIEW),
            paused_search_records=counted(searchable, lambda r: r["paused"]),
            course_title_intro=counted(course, lambda r: r["title_intro"]),
            searchable_title_intro=counted(searchable, lambda r: r["title_intro"]),
            searchable_service_title_intro=counted(searchable, lambda r: r["app_intro"]),
            institutional_records=len(public), external_records=len(external),
            institutional_exploration_candidates=len(p_ok), external_exploration_candidates=len(e_ok),
            institutional_titles_need_review=counted(public, lambda r: r["status"] == UNRESOLVED),
            institutional_non_sport=counted(public, lambda r: r["status"] == NON_SPORT),
            institutional_flagged_content_type=counted(public, lambda r: r["flagged_type"]),
            institutional_title_intro=counted(public, lambda r: r["title_intro"]),
            institutional_usable_title_intro=counted(p_ok, lambda r: r["title_intro"]),
            external_title_intro=counted(external, lambda r: r["title_intro"]),
            external_sample_intro=counted(external, lambda r: r["sample_intro"]),
            external_sample_held=counted(external, lambda r: r["sample_level"] == "판단 보류"),
            external_title_and_sample_intro=counted(external, lambda r: r["sample_intro"] and r["title_intro"]),
            institutional_related_field=counted(fallback, lambda r: r["source"] == "institution") if level == "sport" else None,
            external_related_field=counted(fallback, lambda r: r["source"] == "external") if level == "sport" else None,
            any_related_field_title_intro=counted(fallback, lambda r: r["title_intro"]) if level == "sport" else None,
            external_related_field_sample_intro=counted(fallback, lambda r: r["sample_intro"]) if level == "sport" else None,
            institutional_exact_before=bool(p_ok) if known else None,
            any_exact_after=bool(p_ok or e_ok) if known else None,
            exact_added_by_external=bool(e_ok and not p_ok) if known else None,
        )

    result = []
    for field in field_order:
        rows = grouped.get(field, [])
        field_videos = [r for r in rows if r["source"] != "course"]
        result.append(summarize(rows, field, "", "field", field_videos))
        by_sport = defaultdict(list)
        for row in rows:
            by_sport[row["sport"]].append(row)
        for sport, entries in sorted(by_sport.items()):
            level = "sport" if sport else "unresolved_or_non_sport"
            result.append(summarize(entries, field, sport, level, field_videos))
    return result


def coverage_summary(table, courses, videos):
    sports = [r for r in table if r["confirmed_search_sport"]]
    fields = [r for r in table if r["level"] == "field" and r["confirmed_search_records"]]
    literal_names = {(r["field"], r["sport"]) for r in courses if r["searchable"] and r["status"] == CONFIRMED}
    literal_before = {(r["field"], r["provided_sport"]) for r in videos if r["source"] == "institution" and r["eligible"]}
    literal_after = {(r["field"], r["provided_sport"]) for r in videos if r["eligible"]}
    name_list = lambda rows: [dict(field=r["field"], sport=r["detail_sport"]) for r in rows]
    exact_before = [r for r in sports if r["institutional_exact_before"]]
    exact_after = [r for r in sports if r["any_exact_after"]]
    no_exact_before = [r for r in sports if not r["institutional_exact_before"]]
    newly_covered = [r for r in sports if r["exact_added_by_external"]]
    no_exact_after = [r for r in sports if not r["any_exact_after"]]
    related_only_before = [r for r in no_exact_before if r["institutional_related_field"]]
    related_only = [r for r in no_exact_after if r["institutional_related_field"] or r["external_related_field"]]
    no_any = [r for r in no_exact_after if r not in related_only]
    accessible_record_counts = lambda records: sum(r["confirmed_search_records"] for r in records)
    inferred = [r for r in table if r["level"] == "sport" and r["inferred_course_records"]]
    topic_before = [r["field"] for r in fields if r["institutional_exploration_candidates"]]
    topic_after = [r["field"] for r in fields if r["institutional_exploration_candidates"] or r["external_exploration_candidates"]]
    return dict(
        confirmed_search_sports=len(sports),
        confirmed_search_records=accessible_record_counts(sports),
        inferred_search_records=counted(courses, lambda r: r["searchable"] and r["status"] == INFERRED),
        unresolved_search_records=counted(courses, lambda r: r["searchable"] and r["status"] == REVIEW),
        confirmed_search_fields=len(fields),
        institution_fields_before=topic_before,
        institution_or_external_fields_after=topic_after,
        newly_covered_fields=sorted(set(topic_after) - set(topic_before)),
        sport_exact_before=dict(count=len(exact_before), pct=percentage(len(exact_before), len(sports)),
                                sports=name_list(exact_before), course_records=accessible_record_counts(exact_before)),
        sport_exact_after=dict(count=len(exact_after), pct=percentage(len(exact_after), len(sports)),
                               sports=name_list(exact_after), course_records=accessible_record_counts(exact_after)),
        previously_uncovered_sports=len(no_exact_before), newly_covered_sports=name_list(newly_covered),
        external_gap_fill_pct=percentage(len(newly_covered), len(no_exact_before)),
        literal_exact_before=len(literal_names & literal_before), literal_exact_after=len(literal_names & literal_after),
        related_field_only_before=name_list(related_only_before),
        no_match_before=name_list([r for r in no_exact_before if r not in related_only_before]),
        related_field_only_after=name_list(related_only),
        no_positive_video_path_after=name_list(no_any),
        related_field_only_after_course_records=accessible_record_counts(related_only),
        no_positive_video_path_after_course_records=accessible_record_counts(no_any),
        inferred_sport_coverage=[dict(sport=r["detail_sport"], inferred_courses=r["inferred_course_records"],
                                      exact_videos=r["institutional_exploration_candidates"] +
                                      r["external_exploration_candidates"]) for r in inferred],
    )


def beginner_summary(table, courses, videos):
    stats = {}
    for source in ("course", "institution", "external"):
        rows = [r for r in (courses if source == "course" else videos) if r["source"] == source]
        stats[source] = dict(
            records=len(rows), title_intro=counted(rows, lambda r: r["title_intro"]),
            service_title_intro=counted(rows, lambda r: r["app_intro"]),
            sample_level_counts=dict(Counter(r["sample_level"] for r in rows)) if source == "external" else None,
            eligible_title_intro=counted(rows, lambda r: r["eligible"] and r["title_intro"]) if source != "course" else None,
            title_and_sample_intro=counted(rows, lambda r: r["title_intro"] and r["sample_intro"]) if source == "external" else None,
        )
    stats["searchable_course_title_intro"] = counted(courses, lambda r: r["searchable"] and r["title_intro"])
    stats["searchable_course_rows"] = sum(r["searchable"] for r in courses)
    sports = [r for r in table if r["confirmed_search_sport"]]
    offline_intro = [r for r in sports if r["searchable_title_intro"]]
    sample_intro = [r for r in sports if r["external_sample_intro"]]
    stats["confirmed_search_sports"] = len(sports)
    stats["sports_with_course_title_intro"] = [r["detail_sport"] for r in offline_intro]
    stats["sports_with_exact_external_sample_intro"] = [r["detail_sport"] for r in sample_intro]
    stats["sports_with_both"] = [r["detail_sport"] for r in sample_intro if r["searchable_title_intro"]]
    stats["sports_with_course_title_intro_but_no_exact_sample_intro"] = [
        r["detail_sport"] for r in offline_intro if not r["external_sample_intro"]
    ]
    stats["sports_without_intro_evidence_even_at_field_level"] = [r["detail_sport"] for r in sports
        if not (r["searchable_title_intro"] or r["institutional_usable_title_intro"] or r["external_title_intro"]
                or r["external_sample_intro"] or r["any_related_field_title_intro"] or r["external_related_field_sample_intro"])]
    stats["external_title_without_sample_intro"] = stats["external"]["title_intro"] - stats["external"]["title_and_sample_intro"]
    return stats


def history_summary(rows):
    yearly = defaultdict(list)
    for r in rows:
        yearly[r["수강월_연도"]].append(r)
    comparison = {}
    latest = yearly[2026]
    earlier = [r for r in rows if r["수강월_연도"] < 2026]

    def breakdown(subset, field):
        return dict(Counter(r[field] or "종목 미기재 또는 미확정" for r in subset))

    for name, subset in (("full", rows), ("2026", latest), ("before_2026", earlier)):
        comparison[name] = dict(
            denominator=len(subset), fields=breakdown(subset, "분석_상위_운동_분야"),
            raw_sports=breakdown(subset, "종목"), statuses=breakdown(subset, "분류_상태"),
            confirmed_detail=breakdown([r for r in subset if r["분류_상태"] == CONFIRMED], "표준_세부_종목"),
            inferred_detail=breakdown([r for r in subset if r["분류_상태"] == INFERRED], "표준_세부_종목"),
            title_intro=counted(subset, lambda r: r["제목_입문_표현"]),
        )
    fields = sorted(comparison["full"]["fields"].keys() | comparison["2026"]["fields"].keys())
    composition = {}
    for field in fields:
        full_count = comparison["full"]["fields"].get(field, 0)
        recent_count = comparison["2026"]["fields"].get(field, 0)
        full_pct = 100 * full_count / len(rows)
        recent_pct = 100 * recent_count / len(latest)
        composition[field] = dict(full_count=full_count, full_pct=round(full_pct, 4),
                                  recent_count=recent_count, recent_pct=round(recent_pct, 4),
                                  recent_less_full_pp=round(recent_pct - full_pct, 4))
    new_rows = [r for r in rows if r["과거_전용_원본_종목"]]
    new_labels = {}
    for sport in sorted({r["종목"] for r in new_rows}):
        candidates = [r for r in new_rows if r["종목"] == sport]
        candidate_counts = Counter(
            f"{r['기존_함수_분야_후보']} / {r['기존_함수_세부종목_후보'] or '세부 없음'}" for r in candidates)
        new_labels[sport] = dict(records=len(candidates), rule_candidates=dict(candidate_counts))
    return dict(
        cohorts=comparison, composition=composition,
        yearly={year: dict(denominator=len(subset), fields=breakdown(subset, "분석_상위_운동_분야"),
                           raw_sports=breakdown(subset, "종목"), statuses=breakdown(subset, "분류_상태"),
                           confirmed_detail=breakdown([r for r in subset if r["분류_상태"] == CONFIRMED], "표준_세부_종목"),
                           inferred_detail=breakdown([r for r in subset if r["분류_상태"] == INFERRED], "표준_세부_종목"))
                for year, subset in sorted(yearly.items())},
        historical_novel_records=len(new_rows), historical_novel_labels=new_labels,
    )


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(predicate, reason):
    if not predicate:
        raise ValueError(reason)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=HERE, help="결과 CSV와 JSON을 기록할 디렉터리")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date(2026, 11, 27),
                        help="일반 종료일 비교 기준일 (기본 2026-11-27 KST)")
    args = parser.parse_args()
    target = args.out.resolve()
    require(not any((target / name).exists() for name in FILES), "결과 파일이 존재합니다. --out으로 새 경로를 지정하세요.")
    inputs = dict(
        raw=next(SOURCE.glob("*올림픽스포츠센터*20260601.csv")),
        service=SOURCE / "sports_step_search_2026.csv",
        institution=SOURCE / "sports_step_videos.csv",
        external=SOURCE / "movebridge_youtube_verified.csv",
        p1_metrics=PHASE1 / "summary.json",
        p1_classifications=PHASE1 / "classification_comparison.csv",
        p1_quality=PHASE1 / "quality_issues.csv",
    )
    service_scripts = [
        "Frontend/src/data/public-data-analysis.ts", "Frontend/src/data/discovery.ts",
        "Frontend/src/data/course-display.ts", "Frontend/src/data/course-sport.ts",
        "Frontend/src/data/search.ts", "Frontend/src/data/sample-data.ts",
        "Frontend/src/data/external-videos.ts", "Frontend/src/data/course-eligibility.ts",
        "Frontend/src/features/onboarding/roadmap.ts",
        "Frontend/src/features/workout-planner/planner-model.ts",
    ]
    watched = {path: sha(path) for path in [*inputs.values(), *(ROOT / p for p in service_scripts)]}
    phase1 = json.loads(inputs["p1_metrics"].read_text(encoding="utf-8"))
    require(phase1["context"]["base_commit"] == SERVICE_BASE, "Phase 1 서비스 기준 커밋이 다릅니다.")
    require(not command("git", "diff", SERVICE_BASE, "--name-only", "--", "Frontend", "Backend", ".github", ".maestro"),
            "기준 커밋과 현재 서비스 파일이 다릅니다.")
    raw = read_csv(inputs["raw"], "cp949")
    redact = course_text_redactor(r["강좌명"] for r in raw)
    service, institution, external = (read_csv(inputs[k]) for k in ("service", "institution", "external"))
    p1_classifications = read_csv(inputs["p1_classifications"])
    p1_time = {r["serial"]: r["raw_value"] for r in read_csv(inputs["p1_quality"])
               if r["dataset"] == "올림픽 원본 전체" and r["issue"] == "title_time_review"}
    rules = run_rules(raw, institution, external)
    classified = classify_history(raw, service, rules, p1_time, args.as_of)
    courses, video = make_content(classified, institution, external, rules)
    coverage = coverage_table(courses, video, rules["fields"])
    historical = history_summary(classified)
    linked = coverage_summary(coverage, courses, video)
    beginner = beginner_summary(coverage, courses, video)
    require(len(classified) == phase1["matching"]["raw"] == len({r["일련번호"] for r in classified}),
            "전체 강좌 행 수 또는 원본 ID가 Phase 1과 다릅니다.")
    require(len(courses) == phase1["matching"]["service"] and len(rules["eligible"]) == phase1["search"]["runtime_eligible"],
            "서비스 강좌 건수가 Phase 1과 다릅니다.")
    require(len(institution) == phase1["video"]["institution"] and len(external) == phase1["video"]["external"],
            "영상 건수가 Phase 1과 다릅니다.")
    known_phase1 = {(r["source"], r["id"]): (r["after_field"], r["after_sport"]) for r in p1_classifications}
    require(all((r["field"], r["sport"]) == known_phase1[("강좌", r["id"])] for r in courses),
            "Phase 1 서비스 강좌 분류와 불일치")
    require(all((r["field"], r["sport"]) == known_phase1[("공공기관 영상", r["id"])] for r in video if r["source"] == "institution"),
            "Phase 1 기관 영상 분류와 불일치")
    require(all(r["field"] in rules["fields"] for r in courses + video), "분포에 포함되지 않는 분야")
    for select in (lambda r: r["level"] == "field", lambda r: r["level"] != "field"):
        selected = [r for r in coverage if select(r)]
        totals = [sum(row[k] for row in selected) for k in
                  ("course_records", "searchable_course_records", "institutional_records", "external_records")]
        require(totals == [len(courses), len(rules["eligible"]), len(institution), len(external)],
                "분야 또는 세부 종목 표의 분모가 다릅니다.")
    require(all(sha(path) == digest for path, digest in watched.items()), "입력 또는 서비스 코드가 변경되었습니다.")

    search_other = [r for r in classified if r["기존_검색_분야"] == "기타 운동"]
    paused = [r for r in classified if r["제목_일시중지_표기"]]
    paused_ids = {r["일련번호"] for r in paused if r["서비스_400"]}
    institution_eligibility = Counter(r["status"] for r in video if r["source"] == "institution")
    summary = dict(
        environment=dict(base_commit=SERVICE_BASE,
                         evidence_branch=command("git", "branch", "--show-current"),
                         analysis_as_of_kst=args.as_of.isoformat(), python=platform.python_version(),
                         node=command("node", "-v"), input_sha256_unchanged=True,
                         inputs={str(p.relative_to(ROOT)): digest for p, digest in watched.items()}),
        denominators=dict(raw_courses=len(raw), service_courses=len(courses), searchable_courses=len(rules["eligible"]),
                          institution_videos=len(institution), external_videos=len(external), all_videos=len(video)),
        method=dict(
            historical_policy="기존 분류 함수 직접 실행. 2026년에 없는 원본 종목 표기는 결과 보류 및 후보값 별도 저장.",
            exact="동일 상위 분야와 표준 세부 종목 동시 일치. 줌바→줌바댄스 한 건의 명칭 통합. 동일 과정 미판정.",
            related="동일 상위 분야이며 세부 종목이 다르거나 비어 있는 영상. 정확 일치 개수에 중복 합산하지 않음.",
            coverage_denominator="일반 검색 대상 중 근거가 확인된 강좌에 등장하는 고유 (분야,세부 종목) 또는 분야.",
            video_scope="기관 분포에는 56건 모두 포함. 탐색 지표는 분류 확인 필요·운동 외·행사/접수/홍보 후보 제외. 외부 검증본 131건 사용.",
            beginner="제목 표현은 입문·처음·초급·기초·독립 단어 Beginner. 서비스 제목 규칙과 표본 추천운동경험 별도 저장.",
            historical_data_use="공개 기록 단위. 운영 중인 프로그램 수, 신청 인원, 수요는 미확인.",
            beginner_gap="직접 증거와 같은 분야의 입문 표현·외부 표본 평가가 모두 없는 세부 종목. 현재 운영과 개인 적합성 미확인.",
            known_counts="근거 확인은 원본이나 메타데이터 토픽에 대한 분류 근거이며 기관 영상 실제 강습·시청을 재검증한 값은 아님.",
        ),
        history=historical, coverage=linked, beginner=beginner,
        institution_status=dict(institution_eligibility),
        institution_exploration_candidates=counted(video, lambda r: r["source"] == "institution" and r["eligible"]),
        institution_excluded_from_exploration_ids=[r["id"] for r in video if r["source"] == "institution" and not r["eligible"]],
        external_exact_aliases=dict(EXTERNAL_ALIASES),
        service_observations=dict(
            search_other_records=len(search_other),
            search_other_by_analysis_field=dict(Counter(r["분석_상위_운동_분야"] for r in search_other)),
            paused_original_records=len(paused), paused_service_ids=sorted(paused_ids, key=int),
            paused_searchable_records=counted(paused, lambda r: r["기본검색_399"]),
            paused_in_current_roadmap=len(paused_ids & set(rules["roadmapCourses"])),
            paused_weekly_entries_if_all_bookmarked=rules["pausedProjectionCount"],
            paused_rows=[{k: r[k] for k in ("일련번호", "강좌명", "수강요일", "수강시간", "수강종료일")} for r in paused],
            runtime_title_time_review_service_ids=sorted(rules["timeConflicts"], key=int),
            phase1_title_time_review_ids=sorted(p1_time, key=int),
            phase1_title_time_review_service_ids=sorted(
                [r["일련번호"] for r in classified if r["서비스_400"] and r["Phase1_제목_시간_검토"]], key=int),
            service_end_status=dict(Counter(r["기록_종료일_상태"] for r in classified if r["서비스_400"])),
            current_operation_verified=None,
        ),
    )

    target.mkdir(parents=True, exist_ok=True)
    write_csv(target / FILES[0], classified, redact)
    write_csv(target / FILES[1], coverage, redact)
    with (target / FILES[2]).open("x", encoding="utf-8") as output:
        json.dump(public_value(summary, redact), output, ensure_ascii=False, indent=2, sort_keys=True)
        output.write("\n")
    print(f"강좌 {len(classified)}행 · 연계 집계 {len(coverage)}행 · {target}")


if __name__ == "__main__":
    main()
