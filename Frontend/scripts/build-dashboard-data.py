#!/usr/bin/env python3
"""Project the published Phase 2 audit into dashboard assets. Run from any directory."""

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / "analysis/movebridge_data_audit/phase02"
OUTPUT = ROOT / "Frontend/src/features/data-dashboard/generated"
ORIGINAL_COLUMNS = (
    "일련번호", "강좌일련번호", "강좌서브일련번호", "수강월", "종목", "강좌명", "수강시간",
    "정원", "수강요일", "수강대상", "수강금액", "수강시작일", "수강종료일",
)
STATUSES = ("근거 확인", "추정", "분류 확인 필요", "과거 신규 원본 종목 검토")


def read_csv(name, original_columns=()):
    with (AUDIT / name).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames[:len(original_columns)]) != original_columns:
            raise ValueError(f"Unexpected original columns in {name}")
        return list(reader)


def flag(value):
    return {"True": True, "False": False}[value]


def project_course(row):
    # Keep only screen fields. Titles, names, audience and raw schedule values stay in the audit.
    return [
        row["일련번호"], row["수강월"], int(row["수강월_연도"]), row["종목"],
        row["분석_상위_운동_분야"], row["표준_세부_종목"] or None, row["분류_상태"], row["분류_근거"],
        flag(row["과거_전용_원본_종목"]), flag(row["서비스_400"]), flag(row["기본검색_399"]),
        row["운영_확인_상태"], row["기록_종료일_상태"],
    ]


def validate(rows, coverage, summary):
    totals = summary["denominators"]
    history = summary["history"]
    service = [row for row in rows if flag(row["서비스_400"])]
    search = [row for row in service if flag(row["기본검색_399"])]
    prior = [row for row in rows if not flag(row["서비스_400"])]
    if (len(rows), len(service), len(search)) != (
        totals["raw_courses"], totals["service_courses"], totals["searchable_courses"],
    ) or len({row["일련번호"] for row in rows}) != len(rows):
        raise ValueError("Audit course counts or unique IDs disagree")
    if any(row["분류_상태"] not in STATUSES for row in rows):
        raise ValueError("Unrecognized classification status")
    for cohort, cohort_rows in (("full", rows), ("2026", service), ("before_2026", prior)):
        expected = history["cohorts"][cohort]
        if len(cohort_rows) != expected["denominator"] or any(
            Counter(row[column] for row in cohort_rows) != expected[key]
            for column, key in (("분류_상태", "statuses"), ("분석_상위_운동_분야", "fields"))
        ):
            raise ValueError(f"Audit cohort aggregates disagree for {cohort}")
    if Counter(row["수강월_연도"] for row in rows) != {
        year: values["denominator"] for year, values in history["yearly"].items()
    }:
        raise ValueError("Audit yearly totals disagree")
    fields = [row for row in coverage if row["level"] == "field"]
    for key, expected in (
        ("institutional_records", totals["institution_videos"]), ("external_records", totals["external_videos"]),
        ("institutional_exploration_candidates", summary["institution_exploration_candidates"]),
        ("confirmed_search_records", summary["coverage"]["confirmed_search_records"]),
    ):
        if sum(int(row[key]) for row in fields) != expected:
            raise ValueError(f"Audit coverage totals disagree for {key}")


def project_summary(coverage, summary):
    history = summary["history"]
    service = summary["service_observations"]
    beginner = summary["beginner"]
    confirmed_sports = [row for row in coverage if flag(row["confirmed_search_sport"])]
    return {
        "asOf": summary["environment"]["analysis_as_of_kst"],
        "totals": summary["denominators"],
        "cohorts": {key: {name: value[name] for name in ("denominator", "fields", "statuses", "title_intro")}
                    for key, value in history["cohorts"].items()},
        "years": {year: {name: value[name] for name in ("denominator", "confirmed_detail", "inferred_detail")}
                  for year, value in history["yearly"].items()},
        "novel": {"labels": len(history["historical_novel_labels"]), "records": history["historical_novel_records"],
                  "examples": {name: history["historical_novel_labels"][name]["records"]
                               for name in ("스피닝바이크", "실내축구", "오카리나")}},
        "institutionCandidates": summary["institution_exploration_candidates"],
        "coverage": summary["coverage"],
        "coverageSports": [
            {"field": row["field"], "sport": row["detail_sport"], "courses": int(row["confirmed_search_records"]),
             "institution": int(row["institutional_exploration_candidates"]),
             "external": int(row["external_exploration_candidates"]),
             "institutionRelated": int(row["institutional_related_field"]),
             "externalRelated": int(row["external_related_field"])}
            for row in confirmed_sports
        ],
        "beginner": {"searchTitle": beginner["searchable_course_title_intro"],
                     "institutionTitle": beginner["institution"]["title_intro"],
                     "institutionCandidateTitle": beginner["institution"]["eligible_title_intro"],
                     "externalTitle": beginner["external"]["title_intro"],
                     "externalSampleIntro": beginner["external"]["sample_level_counts"]["입문·기초"],
                     "externalBoth": beginner["external"]["title_and_sample_intro"],
                     "externalHeld": beginner["external"]["sample_level_counts"]["판단 보류"]},
        "quality": {"paused": service["paused_original_records"],
                    "timeConflicts": len(service["runtime_title_time_review_service_ids"]),
                    "specialEnd": service["service_end_status"]["특수 종료일"],
                    "ended": service["service_end_status"]["일반 종료일 경과"]},
        "aliases": summary["external_exact_aliases"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check tracked assets without writing files")
    options = parser.parse_args()
    rows = read_csv("classified_courses.csv", ORIGINAL_COLUMNS)
    coverage = read_csv("content_coverage.csv")
    summary = json.loads((AUDIT / "summary.json").read_text(encoding="utf-8"))
    validate(rows, coverage, summary)
    assets = {
        "overview.json": json.dumps(project_summary(coverage, summary), ensure_ascii=False, indent=2),
        "course-records.json": "[\n" + ",\n".join(
            json.dumps(project_course(row), ensure_ascii=False, separators=(",", ":")) for row in rows
        ) + "\n]",
    }
    for name, contents in assets.items():
        path = OUTPUT / name
        if options.check:
            if path.read_text(encoding="utf-8") != contents + "\n":
                raise ValueError(f"Regenerate {path.relative_to(ROOT)}")
        else:
            OUTPUT.mkdir(parents=True, exist_ok=True)
            path.write_text(contents + "\n", encoding="utf-8")
    print(f"Dashboard assets verified against {len(rows)} course rows and {len(coverage)} coverage rows")


if __name__ == "__main__":
    main()
