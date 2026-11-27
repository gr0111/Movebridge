"""Read original CSVs and the pinned service code. Write UTF-8-BOM audit tables."""

import argparse
import csv
import hashlib
import io
import json
import platform
import re
import subprocess
import sys
import tarfile
import tempfile
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from publication import SERVICE_BASE, course_text_redactor, public_csv_row, public_value

ORIGINAL = ROOT / "Frontend/data/original"
SEOUL = timezone(timedelta(hours=9))
BEFORE_CLASSIFICATION = "4056366d2fb05ca1ece32610e4b7ef74cd84c909"
PROVIDER = "한국체육산업개발주식회사"
OLYMPIC = PROVIDER + "_올림픽스포츠센터 강좌정보_20260601.csv"
INSTITUTION = PROVIDER + "_온라인 강습 동영상_20220629.csv"
CATALOG = PROVIDER + "_스포츠센터 강좌 정보_20260825.csv"
FACILITY = "전국공공시설개방정보표준데이터.csv"
COURSE_KEYS = ("일련번호", "강좌일련번호", "강좌서브일련번호")
SENTINEL = "9999-12-31"
UNKNOWN = "미확인"
NULL_TEXT = {"null", "none", "nan", "n/a", "na", "-", "미기재", "미상", "없음"}
DATE_FIELDS = {"수강월", "수강시작일", "수강종료일", "등록일", "수정일", "데이터기준일자"}
ID_FIELDS = {*COURSE_KEYS, "순번", "원본 ID", "id", "유튜브영상ID", "제공기관코드"}
NUM_FIELDS = {"수강금액", "정원", "조회수", "금액_검색", "시간_길이분", "위도", "경도",
              "수용가능인원수", "면적", "사용기준시간", "댓글참고건수"}
FORM_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
NUMBER = re.compile(r"[+-]?\d+(?:\.\d+)?")
TIME = re.compile(r"([01]\d|2[0-3]):([0-5]\d)\s*[-–~]\s*([01]\d|2[0-3]):([0-5]\d)")
ONE_TIME = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d")
DAYS = re.compile(r"(?:[월화수목금토일]|\([월화수목금토일]\))(?:\s*,\s*(?:[월화수목금토일]|\([월화수목금토일]\)))*")
SPORT_WORD = re.compile(r"테니스|배드민턴|탁구|검도|골프|농구|당구|실내승마|수영|헬스|요가|필라테스")
SPORT_FACILITY = re.compile(
    r"체육관|축구장|테니스장|풋살(?:경기장|장)|족구장|야구장|농구장|배드[민맨]턴장|골프장|"
    r"배구장|게이트볼장|수영장|헬스장|탁구장|볼링장|씨름장|스쿼시장|론볼경기장|"
    r"국궁장|운동장|생활체조(?:장|실)"
)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rate(n, d):
    return round(100 * n / d, 4) if d else None


def normalize(value):
    return " ".join(unicodedata.normalize("NFC", value).split())


def number(value):
    text = value.strip()
    return Decimal(text) if NUMBER.fullmatch(text) else None


def date_value(value):
    if not FORM_DATE.fullmatch(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def read_table(path, name):
    content = path.read_bytes()
    for codec in ("utf-8-sig", "cp949"):
        try:
            decoded = content.decode(codec, errors="strict")
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"UTF-8/CP949로 해독할 수 없음: {path}")
    encoding = codec if codec == "cp949" or content.startswith(b"\xef\xbb\xbf") else "utf-8"
    reader = csv.reader(io.StringIO(decoded, newline=""), delimiter=",", strict=True)
    header = next(reader)
    if len(set(header)) != len(header):
        raise ValueError(f"중복 헤더: {path}")
    rows = []
    anomalies = []
    for row in reader:
        if len(row) != len(header):
            anomalies.append((reader.line_num, len(row)))
        else:
            rows.append(dict(zip(header, row)))
    if anomalies:
        raise ValueError(f"{path}: 예상 열 {len(header)}, 비정상 행 {anomalies[:10]}")
    return {"name": name, "path": path, "header": header, "encoding": encoding, "rows": rows,
            "sha": hashlib.sha256(content).hexdigest(), "bytes": len(content)}


def csv_out(out, name, rows, redact, fields=None):
    columns = fields or list(dict.fromkeys(key for row in rows for key in row))
    with (out / name).open("x", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(public_csv_row(row, redact) for row in rows)


def column_type(key):
    if key in ID_FIELDS:
        return "식별 문자열"
    if key in DATE_FIELDS:
        return "ISO 날짜"
    if key in NUM_FIELDS:
        return "수치"
    if key in {"수강시간"}:
        return "시간 범위"
    if "링크" in key or "URL" in key or key == "홈페이지주소":
        return "URL 텍스트"
    if key.endswith(("오류", "검토", "특수표기")):
        return "불리언 표기"
    if key.endswith(("시각", "_시작", "_종료")):
        return "시각 표기"
    return "문자열"


def missing_buckets(value):
    if value is None:
        return "null"
    if not value:
        return "empty"
    if not value.strip():
        return "whitespace"
    if value.strip().casefold() in NULL_TEXT:
        return "semantic_candidate"
    return "present"


def missing_profile(name, rows, header):
    for key in header:
        values = [row[key] for row in rows]
        buckets = Counter(map(missing_buckets, values))
        strict_missing = sum(buckets[label] for label in ("null", "empty", "whitespace"))
        present = {value for value in values if missing_buckets(value) == "present"}
        examples = sorted({value for value in values if missing_buckets(value) == "semantic_candidate"})
        yield dict(dataset=name, column=key, inferred_type=column_type(key), total=len(rows),
                   null=buckets["null"], empty=buckets["empty"], whitespace=buckets["whitespace"],
                   strict_missing=strict_missing, strict_missing_pct=rate(strict_missing, len(rows)),
                   semantic_candidates=buckets["semantic_candidate"], candidate_values=" | ".join(examples),
                   present=len(rows) - strict_missing - buckets["semantic_candidate"],
                   unique_present=len(present), unique_raw=len(set(values)))


def groups(rows, cols):
    result = defaultdict(list)
    for row in rows:
        result[tuple(row[col] for col in cols)].append(row)
    return result


def duplicate_stats(name, rows, cols, label):
    keyed = groups(rows, cols)
    repeated = [group for group in keyed.values() if len(group) > 1]
    group_sizes = [len(group) for group in repeated]
    return dict(dataset=name, key=label, total_rows=len(rows), distinct=len(keyed),
                distinct_nonblank=sum(all(part.strip() for part in key) for key in keyed),
                rows_with_blank_key=sum(len(value) for key, value in keyed.items()
                                        if any(not part.strip() for part in key)),
                duplicate_groups=len(group_sizes), rows_in_groups=sum(group_sizes),
                duplicate_excess=sum(size - 1 for size in group_sizes))


def runtime_data():
    source = """
import { courses, videos, onlineVideos, searchableCourses, excludedCourses, courseEligibility, searchCourses }
  from './Frontend/src/data/search.ts';
import { rawCourses, rawVideos } from './Frontend/src/data/sample-data.ts';
import { externalVideos } from './Frontend/src/data/external-videos.ts';
import { analyzedCourses, analyzedInstitutionVideos } from './Frontend/src/data/public-data-analysis.ts';
import { classifyCourse, analyzeBeginnerTitle } from './Frontend/src/data/discovery.ts';
import { resolveCourseSport } from './Frontend/src/data/course-sport.ts';
let titles = JSON.parse(await new Promise(resolve => {
  let data = ''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => resolve(data));
}));
console.log(JSON.stringify({ rawCourses, rawVideos, externalVideos,
  courseClass: Object.fromEntries(analyzedCourses), videoClass: Object.fromEntries(analyzedInstitutionVideos),
  searchClass: Object.fromEntries(courses.map(row => [row.id, classifyCourse(row)])),
  displaySports: Object.fromEntries(courses.map(row => [row.id, resolveCourseSport(row)])),
  eligible: searchableCourses.map(row => row.id),
  searchDefault: searchCourses({mode:'offline', sport:'전체 종목', days:[], start:'00', end:'24', budget:Infinity}).map(row => row.id),
  excluded: excludedCourses.map(row => ({...row, ...courseEligibility.get(row.id)})),
  counts: [courses.length,videos.length,externalVideos.length,onlineVideos.length],
  runtimeKeywords: Object.fromEntries(titles.map(title => [title, analyzeBeginnerTitle(title).beginnerMatchedTerms]))
}));
"""
    old_source = """
import { courses, videos } from './Frontend/src/data/search.ts';
import { classifyCourse, classifyVideo } from './Frontend/src/data/discovery.ts';
console.log(JSON.stringify({
  courses: Object.fromEntries(courses.map(row => [row.id, classifyCourse(row, false)])),
  videos: Object.fromEntries(videos.map(row => [row.id, classifyVideo(row)]))
}));
"""
    return source, old_source


def run_node(source, cwd, data=None):
    command = ["node", "--disable-warning=ExperimentalWarning", "--input-type=module", "-e", source]
    return json.loads(subprocess.check_output(command, cwd=cwd, input=json.dumps(data).encode()))


def service_snapshots(titles):
    source, old_source = runtime_data()
    current = run_node(source, ROOT, sorted(set(titles)))
    with tempfile.TemporaryDirectory(prefix="movebridge-audit-") as scratch:
        with tarfile.open(fileobj=io.BytesIO(git("archive", BEFORE_CLASSIFICATION, "Frontend/src/data"))) as archive:
            for member in archive:
                if member.isfile() and member.name.endswith(".ts") and not member.name.startswith("/"):
                    target = Path(scratch) / member.name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.extractfile(member).read())
        before = run_node(old_source, Path(scratch))
    return current, before


def compare(row, ref, columns):
    return [col for col in columns if row[col] != ref[col]]


def equal_field(col, value, other):
    if normalize(value) == normalize(other):
        return True
    price = number(value) if col == "수강금액" else None
    return price is not None and price == number(other)


def normalized_fields(row, cols):
    return tuple(
        str(number(row[col]).normalize())
        if col == "수강금액" and number(row[col]) is not None else normalize(row[col])
        for col in cols
    )


def match_records(raw, service, year, header):
    keys = [("일련번호", COURSE_KEYS[:1]), ("강좌·서브일련번호", COURSE_KEYS[1:]),
            ("공통 필드 원문", tuple(header)),
            ("정규화 공통 필드", tuple(col for col in header if col != "일련번호")),
            ("복합키 후보", ("강좌명", "수강월", "수강시간", "수강요일", "수강금액"))]
    indexes = []
    for name, cols in keys:
        normalize_key = name in {"정규화 공통 필드", "복합키 후보"}
        raw_index, service_index = defaultdict(list), defaultdict(list)
        for rows, index in ((raw, raw_index), (service, service_index)):
            for row in rows:
                key = normalized_fields(row, cols) if normalize_key else tuple(row[col] for col in cols)
                index[key].append(row)
        indexes.append((name, cols, raw_index, service_index, normalize_key))
    match = []
    linked = set()
    for row in service:
        result = None
        for name, cols, raw_index, service_index, normalize_key in indexes:
            key = normalized_fields(row, cols) if normalize_key else tuple(row[col] for col in cols)
            if (not normalize_key and cols in (COURSE_KEYS[:1], COURSE_KEYS[1:]) and not all(key)) or key not in raw_index:
                continue
            candidates = raw_index[key]
            one = len(candidates) == len(service_index[key]) == 1
            affirmed = [r for r in candidates if all(equal_field(col, row[col], r[col])
                                                     for col in header if col not in COURSE_KEYS[:1])]
            if one and affirmed and affirmed[0]["일련번호"] not in linked:
                ref = affirmed[0]
                linked.add(ref["일련번호"])
                changes = compare(row, ref, header)
                result = (name, "확정 1:1", ref, changes, candidates)
                break
            if result is None:
                status = "다:다" if len(service_index[key]) > 1 and len(candidates) > 1 else (
                    "1:다" if len(candidates) > 1 else "다:1" if not one else "추정 후보")
                result = (name, status, None, [], candidates)
        name, status, ref, changes, candidates = result or ("", "미매칭", None, [], [])
        match.append(dict(service_serial=row["일련번호"], raw_serial=ref["일련번호"] if ref else "",
                          course_id=row[COURSE_KEYS[1]], sub_id=row[COURSE_KEYS[2]],
                          month=row["수강월"], title=row["강좌명"], method=name,
                          status=status, candidate_count=len(candidates),
                          candidate_raw_ids=" | ".join(c["일련번호"] for c in candidates),
                          exact_all_fields=bool(ref and not changes),
                          differing_fields=" | ".join(changes),
                          source_fee=ref["수강금액"] if ref else "", service_fee=row["수강금액"]))
    unmatched = [{"side": "서비스", "serial": row["service_serial"], "month": row["month"],
                  "title": row["title"], "reason": row["status"]}
                 for row in match if row["status"] != "확정 1:1"]
    year_ids = {row["일련번호"] for row in year}
    unmatched.extend(dict(side="원본 2026" if r["일련번호"] in year_ids else "원본 2026년 외",
                          serial=r["일련번호"], month=r["수강월"], title=r["강좌명"],
                          reason="확정 대응 없음" if r["일련번호"] in year_ids else "2026년 수강월 추출 범위 외")
                     for r in raw if r["일련번호"] not in linked)
    return match, unmatched, linked


def recalculate_derived(rows):
    mismatches = Counter()
    for row in rows:
        weekday = row["수강요일"]
        tokens = [token.strip() for token in weekday.split(",")]
        period = TIME.fullmatch(row["수강시간"])
        if period:
            h1, m1, h2, m2 = map(int, period.groups())
            first, last = f"{h1:02d}:{m1:02d}", f"{h2:02d}:{m2:02d}"
            minutes = (h2 - h1) * 60 + m2 - m1
        else:
            first, last, minutes = "", "", None
        expected = {
            "요일_기본표기": ",".join(t for t in tokens if t and not t.startswith("(")),
            "요일_괄호표기": ",".join(t[1:-1] for t in tokens if t.startswith("(") and t.endswith(")")),
            "요일_형식오류": str(not DAYS.fullmatch(weekday)),
            "시간_시작": first, "시간_종료": last,
            "시간_길이분": Decimal(minutes) if minutes is not None else None,
            "시간_형식오류": str(not period),
            "시간_순서오류": str(minutes is not None and minutes <= 0),
            "시간_장시간검토": str(minutes is not None and minutes > 240),
            "종목_검색": row["종목"].strip() or "종목 미기재",
            "금액_검색": number(row["수강금액"]),
            "종료일_특수표기": str(row["수강종료일"] == SENTINEL),
        }
        for field, value in expected.items():
            actual = number(row[field]) if field in {"시간_길이분", "금액_검색"} else row[field]
            mismatches[field] += actual != value
    return dict(mismatches)


def course_issues(dataset, rows, cutoff):
    summary = Counter()
    amounts = []
    issues = []
    for row in rows:
        def flag(kind, field, value, note=""):
            summary[kind] += 1
            issues.append(dict(dataset=dataset, serial=row["일련번호"], title=row["강좌명"],
                               issue=kind, field=field, raw_value=value, note=note))

        for field in ("수강월", "수강시작일", "수강종료일"):
            if date_value(row[field]) is None:
                flag("date_missing_or_invalid", field, row[field])
        month = date_value(row["수강월"])
        start = date_value(row["수강시작일"])
        end = date_value(row["수강종료일"])
        if month and month.year == 1990:
            flag("month_1990", "수강월", row["수강월"], "기록 의미 미확인")
        if month and month.day != 1:
            flag("month_not_first_day", "수강월", row["수강월"], "필드 의미 확인 후보")
        if month and start and month != start:
            flag("month_start_differs", "수강월/수강시작일", f"{month} / {start}", "의미 차이 후보")
        if end and row["수강종료일"] == SENTINEL:
            flag("sentinel_end", "수강종료일", SENTINEL, "기관 설명상 영구 기간 등록. 현재 운영·모집 별도 확인")
        elif end:
            summary["ordinary_end"] += 1
            if end < cutoff:
                flag("ordinary_end_expired", "수강종료일", str(end), "기록상 종료일 경과. 현재 운영 별도 확인")
        if start and end and start > end:
            flag("reversed_dates", "수강시작일/수강종료일", f"{start} / {end}")
        for field in (*COURSE_KEYS, "강좌명", "종목", "수강대상", "수강금액", "수강요일", "수강시간"):
            if not row[field].strip():
                flag("missing_" + field, field, row[field])
        fee = number(row["수강금액"])
        if fee is not None:
            amounts.append(fee)
            if fee == 0:
                flag("fee_zero", "수강금액", row["수강금액"])
            if fee < 0:
                flag("fee_negative", "수강금액", row["수강금액"])
            if fee != fee.to_integral_value():
                flag("fee_fractional", "수강금액", row["수강금액"])
        elif row["수강금액"].strip():
            flag("fee_invalid", "수강금액", row["수강금액"])
        period = TIME.fullmatch(row["수강시간"])
        if period:
            h1, m1, h2, m2 = map(int, period.groups())
            minutes = (h2 - h1) * 60 + m2 - m1
            if minutes <= 0:
                flag("time_nonincreasing", "수강시간", row["수강시간"])
            elif minutes > 240:
                flag("time_over_240m", "수강시간", row["수강시간"], "공개 시간 범위. 1회차 길이 미확인")
        elif row["수강시간"].strip():
            flag("time_invalid", "수강시간", row["수강시간"])
        title_time = re.search(r"(?<!\d)((?:[01]\d|2[0-3]))\s*[~–]\s*((?:[01]\d|2[0-3]))시", row["강좌명"])
        if title_time and period and (title_time[1], title_time[2]) != (period[1], period[3]):
            flag("title_time_review", "강좌명/수강시간", title_time[0] + " / " + row["수강시간"],
                 "제목의 명시 시각 범위와 시간 필드가 다름. 실제 운영 시각은 별도 확인")
        if row["수강요일"].strip() and not DAYS.fullmatch(row["수강요일"]):
            flag("weekday_invalid", "수강요일", row["수강요일"])
        elif "(" in row["수강요일"]:
            flag("weekday_parenthesis", "수강요일", row["수강요일"], "괄호 요일 의미 미확인")
        title_sports = set(SPORT_WORD.findall(row["강좌명"].replace("헬스등록필수", "")))
        if title_sports and row["종목"].strip() and not any(s in row["종목"] for s in title_sports):
            flag("sport_title_review", "종목/강좌명", row["종목"] + " / " + row["강좌명"],
                 "제목에 다른 운동 단어가 보임. 구성·장소·프로그램 이름일 수 있어 검토 후보")

    for keys in [(COURSE_KEYS[0],), COURSE_KEYS[1:]]:
        for key, identical in groups(rows, keys).items():
            if len(identical) <= 1:
                continue
            for row in identical:
                issues.append(dict(dataset=dataset, serial=row["일련번호"], title=row["강좌명"],
                                   issue="duplicate_identifier", field=" + ".join(keys),
                                   raw_value=" + ".join(key), note=f"{len(identical)}행"))
    summary["fee_min"] = int(min(amounts)) if amounts else None
    summary["fee_max"] = int(max(amounts)) if amounts else None
    summary["fee_unique"] = len(set(amounts))
    # Observed extremes are review candidates, with each source's fee period still unknown.
    for row in rows:
        fee = number(row["수강금액"])
        if fee is not None and fee > 0 and fee in {summary["fee_min"], summary["fee_max"]}:
            issues.append(dict(dataset=dataset, serial=row["일련번호"], title=row["강좌명"],
                               issue="fee_range_boundary", field="수강금액", raw_value=row["수강금액"],
                               note="관찰 최솟값 또는 최댓값. 금액의 회차·기간 단위 미확인"))
    for field in ("종목", "수강요일", "수강대상"):
        summary[field + "_표기수"] = len({row[field] for row in rows if row[field].strip()})
    for issue in ("date_missing_or_invalid", "month_1990", "month_not_first_day", "month_start_differs",
                  "reversed_dates", "fee_zero", "fee_negative", "fee_fractional", "fee_invalid",
                  "time_nonincreasing", "time_invalid", "weekday_invalid", "title_time_review",
                  *("missing_" + field for field in (*COURSE_KEYS, "강좌명", "종목", "수강대상",
                                                     "수강금액", "수강요일", "수강시간"))):
        summary.setdefault(issue, 0)
    return summary, issues


def yt_id(url):
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    parts = parsed.path.strip("/").split("/")
    if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parts[0] in {"embed", "shorts", "live"} and len(parts) > 1:
            return parts[1]
        return parse_qs(parsed.query).get("v", [""])[0]
    if host == "youtu.be":
        return parts[0]
    return ""


def keyword_audit(datasets, runtime_terms):
    details = []
    summary = {}
    for name, rows, key, title_key in datasets:
        counts = Counter(denominator=len(rows))
        for row in rows:
            title = row[title_key]
            ko = [term for term in ("입문", "처음", "초급", "기초") if term in title]
            en = bool(re.search(r"\bBeginner\b", title, flags=re.IGNORECASE | re.ASCII))
            app = runtime_terms[title]
            if ko or en or app:
                details.append(dict(dataset=name, id=row[key], title=title,
                                    korean_terms=" | ".join(ko), english_beginner=en,
                                    service_terms=" | ".join(app), literal_match=bool(ko or en),
                                    service_match=bool(app)))
            counts.update(ko)
            counts["korean"] += bool(ko)
            counts["english"] += en
            counts["korean_or_english"] += bool(ko or en)
            counts["service"] += bool(app)
            counts["literal_only"] += bool(ko or en) and not app
        summary[name] = dict(counts)
    return summary, details


def public_input_location(key, path):
    if key in {"institution_attachment", "center_catalog", "facilities", "full_converted",
               "year_converted", "search_attachment"}:
        return f"source-dir/{path.name}"
    return path.relative_to(ROOT).as_posix()


def inventory(tables, input_hashes, cutoff, meta):
    for key, table in tables.items():
        provider, url, filename_date, registered, modified, lineage = meta[key]
        path = table["path"]
        yield dict(dataset=key, path=public_input_location(key, path), filename=path.name, provider=provider, source_url=url,
                   filename_date=filename_date, official_data_as_of=(
                       "행별 데이터기준일자" if key == "facilities" else UNKNOWN),
                   portal_registered=registered, portal_modified=modified,
                   collection_date=UNKNOWN, analysis_date_kst=cutoff.isoformat(), role=table["name"],
                   bytes=table["bytes"], sha256_before=table["sha"], sha256_after=input_hashes[str(path)],
                   encoding=table["encoding"], delimiter=",", rows=len(table["rows"]),
                   columns=len(table["header"]), headers=" | ".join(table["header"]),
                   types=" | ".join(f"{col}={column_type(col)}" for col in table["header"]),
                   malformed_rows=0, generation_and_references=lineage)


def path_option(dirpath, name, optional=False):
    path = (dirpath / name).resolve()
    if optional and not path.is_file():
        return None
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True, help="사용자가 제공한 공공데이터 디렉터리")
    parser.add_argument("--out", type=Path, required=True, help="새 결과 폴더. 기존 폴더를 덮어쓰지 않음")
    parser.add_argument("--as-of", type=date.fromisoformat, default=datetime.now(SEOUL).date())
    args = parser.parse_args()
    output = args.out.resolve()
    if output.exists():
        parser.error("결과 경로가 이미 존재합니다. 새 폴더를 지정하세요.")
    base_commit = git("rev-parse", SERVICE_BASE).decode().strip()
    branch = git("branch", "--show-current").decode().strip()
    files = {
        "olympic": (ORIGINAL / OLYMPIC, "올림픽스포츠센터 원본"),
        "service_courses": (ORIGINAL / "sports_step_search_2026.csv", "2026년 검색 가공본"),
        "institution_raw": (ORIGINAL / INSTITUTION, "기관 영상 원본"),
        "institution_attachment": (path_option(args.source_dir, INSTITUTION), "첨부 기관 영상 원본"),
        "institution": (ORIGINAL / "sports_step_videos.csv", "기관 영상 가공본"),
        "external": (ORIGINAL / "movebridge_youtube_verified.csv", "외부 영상 검증본"),
        "excluded_external": (ORIGINAL / "movebridge_youtube_excluded.csv", "외부 영상 제외본"),
        "prior_audit": (ROOT / "Frontend/data/audit/public-data-classification.csv", "기존 분류 감사본"),
        "center_catalog": (path_option(args.source_dir, CATALOG), "스포츠센터 소개 원본"),
        "facilities": (path_option(args.source_dir, FACILITY), "전국 시설개방 보조 원본"),
    }
    for key, name in [("full_converted", "sports_step_all_2026source.csv"),
                      ("year_converted", "sports_step_courses_2026.csv"),
                      ("search_attachment", "sports_step_search_2026.csv")]:
        path = path_option(args.source_dir, name, optional=True)
        if path is not None:
            files[key] = (path, "이전 전처리 산출물")
    tables = {key: read_table(path, role) for key, (path, role) in files.items()}
    original = tables["olympic"]
    raw = original["rows"]
    redact = course_text_redactor(r["강좌명"] for r in raw)
    original_columns = original["header"]
    parsed_year = lambda row: date_value(row["수강월"]).year if date_value(row["수강월"]) else None
    year_data = [row for row in raw if parsed_year(row) == 2026]
    service = tables["service_courses"]["rows"]
    institution = tables["institution_raw"]["rows"]
    external = tables["external"]["rows"]
    excluded_external = tables["excluded_external"]["rows"]
    titles = [r["강좌명"] for r in raw + service] + [r["제목"] for r in institution]
    titles.extend(r["영상제목"] for r in external)

    source_files = [p for p in (ROOT / "Frontend/src/data").glob("*.ts")]
    source_files.extend([ROOT / "Frontend/src/App.tsx", ORIGINAL / "movebridge_youtube_verification_report.md",
                         ROOT / "Frontend/data/audit/README.md"])
    watched = {str(p): sha(p) for p in source_files}
    current, before = service_snapshots(titles)

    matches, unmatched, linked = match_records(raw, service, year_data, original_columns)
    matched_status = Counter(row["status"] for row in matches)
    raw_year_ids = {row["일련번호"] for row in year_data}
    different_fields = Counter(field for row in matches for field in row["differing_fields"].split(" | ") if field)
    runtime_csv_equal = current["rawCourses"] == service
    data_checks = {}
    for key, reference in [("full_converted", raw), ("year_converted", year_data),
                           ("search_attachment", service)]:
        if key not in tables:
            data_checks[key] = UNKNOWN
            continue
        version = tables[key]["rows"]
        ref_by_id = {r["일련번호"]: r for r in reference}
        fields = list(reference[0])
        data_checks[key] = dict(rows=len(version), same_row_ids_order=[r["일련번호"] for r in version] ==
                                [r["일련번호"] for r in reference],
                                exact_differences=dict(Counter(
                                    col for row in version if row["일련번호"] in ref_by_id
                                    for col in compare(row, ref_by_id[row["일련번호"]], fields))),
                                semantic_differences=sum(
                                    row["일련번호"] not in ref_by_id or any(
                                        not equal_field(col, row[col], ref_by_id[row["일련번호"]][col]) for col in fields)
                                    for row in version))
    matching = dict(raw=len(raw), year_2026=len(year_data), service=len(service),
                    status={status: matched_status[status] for status in
                            ("확정 1:1", "1:다", "다:1", "다:다", "추정 후보", "미매칭")},
                    before_2026=sum(y is not None and y < 2026 for y in map(parsed_year, raw)),
                    after_2026=sum(y is not None and y > 2026 for y in map(parsed_year, raw)),
                    month_parse_failed=sum(y is None for y in map(parsed_year, raw)),
                    exact_all_fields=sum(row["exact_all_fields"] for row in matches),
                    differing_fields=dict(different_fields),
                    service_without_confirmed=len(service) - len(linked),
                    year_2026_without_confirmed=len(raw_year_ids - linked),
                    full_without_confirmed=len(raw) - len(linked),
                    service_match_pct=rate(len(linked), len(service)),
                    year_coverage_pct=rate(len(linked & raw_year_ids), len(year_data)),
                    full_coverage_pct=rate(len(linked), len(raw)),
                    runtime_csv_equal=runtime_csv_equal, historical_conversion=data_checks,
                    service_derived_mismatches=recalculate_derived(service))

    datasets = [("올림픽 원본 전체", raw), ("올림픽 2026년", year_data), ("서비스 강좌", service)]
    duplicates = []
    for name, rows in datasets:
        all_fields = tuple(rows[0])
        keys = [(all_fields, "완전 동일"), (original_columns, "원본 필드 전체"),
                (tuple(c for c in original_columns if c != COURSE_KEYS[0]), "일련번호 제외 원본 필드"),
                *((([key], key) for key in COURSE_KEYS)),
                (COURSE_KEYS[1:], "강좌일련번호+강좌서브일련번호"), (("강좌명",), "강좌명")]
        duplicates.extend(duplicate_stats(name, rows, fields, label) for fields, label in keys)
    title_repeats = {
        name: dict(repeated_titles=sum(len(group) > 1 for group in groups(rows, ("강좌명",)).values()),
                   repeated_titles_with_different_month=sum(len({r["수강월"] for r in group}) > 1
                                                          for group in groups(rows, ("강좌명",)).values()),
                   repeated_titles_with_different_time=sum(len({r["수강시간"] for r in group}) > 1
                                                         for group in groups(rows, ("강좌명",)).values()))
        for name, rows in datasets
    }
    for name, rows, header, key_list in [
        ("기관 영상", institution, tables["institution_raw"]["header"], ("순번", "제목", "링크주소")),
        ("외부 YouTube", external, tables["external"]["header"], ("id", "유튜브영상ID", "원본영상URL", "영상제목")),
    ]:
        duplicates.append(duplicate_stats(name, rows, header, "완전 동일"))
        duplicates.extend(duplicate_stats(name, rows, (key,), key) for key in key_list)

    quality = {}
    issues = []
    for name, rows in datasets:
        quality[name], found = course_issues(name, rows, args.as_of)
        issues.extend(found)

    classifications = []
    prior_rows = {(row["출처"], row["원본 ID"]): row for row in tables["prior_audit"]["rows"]}
    course_class_totals = defaultdict(Counter)
    aliases = {"배드민턴 단기속성", "탁구단기속성", "실내승마교실"}
    for source, key, title_key, records, old_map, new_map in [
        ("강좌", "일련번호", "강좌명", service, before["courses"], current["courseClass"]),
        ("공공기관 영상", "순번", "제목", institution, before["videos"], current["videoClass"]),
    ]:
        for row in records:
            ident = row[key]
            old = old_map[ident]
            new = new_map[ident]
            prior = prior_rows.get((source, ident), {})
            field = new["field"]
            detail = new["sport"]
            sport = row.get("종목", "")
            if new.get("inferred"):
                status = "추정 약어"
            elif field in ("분류 확인 필요", "운동 외 콘텐츠"):
                status = field
            elif source == "공공기관 영상":
                status = "제목 및 기존 주제 근거" if detail else "상위 분야만 확인"
            elif sport == detail:
                status = "원본 종목과 일치"
            elif sport in aliases:
                status = "표준 명칭"
            elif sport == "방학특강":
                status = "프로그램 유형과 제목 종목 구분"
            else:
                status = "원본 종목과 제목의 세부 유형 구분"
            attach_matches_runtime = (prior.get("이전 분야") == old["field"]
                                      and prior.get("새 분야") == field
                                      and prior.get("세부 종목 후보", "") == (detail or ""))
            course_class_totals[(source, "before")][old["field"]] += 1
            course_class_totals[(source, "after")][field] += 1
            course_class_totals[(source, "audit_status")][status] += 1
            classifications.append(dict(source=source, id=ident, title=row[title_key], original_sport=sport,
                                        description_field="없음", before_field=old["field"],
                                        before_evidence=old["evidence"], after_field=field,
                                        after_sport=detail, after_evidence=new["evidence"],
                                        audit_state=status, previous_audit_matches_runtime=attach_matches_runtime,
                                        search_field=current["searchClass"].get(ident, {}).get("field", "")
                                        if source == "강좌" else "",
                                        display_sport=current["displaySports"].get(ident, {}).get("displaySport", "")
                                        if source == "강좌" else "",
                                        review_note=prior.get("추가 검토", "")))

    source_by_id = {r["일련번호"]: r for r in service}
    search_rows = [{"id": row["id"], "title": row["title"], "original_sport": source_by_id[str(row["id"])]["종목"],
                    "eligibility": row["searchableAsCourse"], "resolution": row["sportResolutionStatus"],
                    "reason": row["exclusionReason"], "data_quality": "원본 종목 결측",
                    "code": "Frontend/src/data/course-eligibility.ts:4, Frontend/src/data/search.ts:42"}
                   for row in current["excluded"]]
    eligible = set(map(str, current["eligible"]))
    search_data = [row for row in service if row["일련번호"] in eligible]
    search_summary = dict(runtime_eligible=len(eligible), csv_eligible=len(search_data),
                          unfiltered_runtime_search=len(current["searchDefault"]), excluded=search_rows)

    raw_video_group = {row["순번"]: row for row in institution}
    derived_videos = tables["institution"]["rows"]
    source_fields = {"제목": "제목", "등록일": "등록일", "조회수": "조회수", "링크주소": "영상링크"}
    video_disagreements = sum(row["순번"] not in raw_video_group or any(
        row[destination] != raw_video_group[row["순번"]][field] for field, destination in source_fields.items())
        for row in derived_videos)
    video_class = {r["id"]: r for r in classifications if r["source"] == "공공기관 영상"}
    types_by_id = {r["순번"]: r["콘텐츠유형"] for r in derived_videos}
    external_ids = {r["유튜브영상ID"] for r in external if r["유튜브영상ID"]}
    institution_yt_ids = {x for x in (yt_id(r["링크주소"]) for r in institution) if x}
    omitted_ids = {r["유튜브영상ID"] for r in excluded_external if r["유튜브영상ID"]}
    title_groups = groups(institution, ("제목",))
    repeated_videos = [group for group in title_groups.values() if len(group) > 1]
    video_rows = []
    for r in institution:
        video_rows.append(dict(source="공공기관", id=r["순번"], title=r["제목"], url=r["링크주소"],
                               date=r["등록일"], youtube_id=yt_id(r["링크주소"]),
                               same_title_records=len(title_groups[(r["제목"],)]),
                               type=types_by_id.get(r["순번"], UNKNOWN),
                               classification=video_class[r["순번"]]["after_field"],
                               evidence=video_class[r["순번"]]["after_evidence"], live_check=UNKNOWN))
    for r in external:
        video_rows.append(dict(source="외부 YouTube", id=r["id"], title=r["영상제목"], url=r["원본영상URL"],
                               date=r["검증일시"], youtube_id=r["유튜브영상ID"], type=r["내용확인상태"],
                               classification=r["관심분야"], evidence=r["난이도판단근거"], live_check=UNKNOWN))
    display_mapping = {
        "id": "id", "youtubeId": "유튜브영상ID", "title": "영상제목", "sport": "관심분야",
        "discipline": "세부종목", "channel": "채널명", "url": "원본영상URL", "thumbnail": "원본썸네일URL",
        "difficulty": "영상난이도", "experience": "추천운동경험", "confidence": "난이도신뢰도",
        "observedRange": "실제확인구간", "difficultyEvidence": "난이도판단근거",
    }
    runtime_external = {r["id"]: r for r in current["externalVideos"]}
    compared_external = sum(row["id"] in runtime_external and all(runtime_external[row["id"]][prop] == row[col]
                                                                for prop, col in display_mapping.items())
                            for row in external)
    video_summary = dict(institution=len(institution), institution_derived=len(derived_videos),
                         institution_attachment_identical=tables["institution_attachment"]["sha"] ==
                         tables["institution_raw"]["sha"],
                         institution_title_unique=len(title_groups),
                         institution_link_unique=len({r["링크주소"] for r in institution}),
                         institution_full_duplicate_excess=len(institution) -
                         len({tuple(r.values()) for r in institution}),
                         institution_derived_source_field_disagreements=video_disagreements,
                         institution_runtime_csv_equal=current["rawVideos"] == derived_videos,
                         institution_date_counts=dict(Counter(r["등록일"] for r in institution)),
                         institution_repeated_titles=repeated_videos,
                         institution_type_counts=dict(Counter(types_by_id.values())),
                         external=len(external), external_unique_youtube_ids=len(external_ids),
                         external_duplicate_id_excess=sum(n - 1 for n in Counter(
                             r["유튜브영상ID"] for r in external if r["유튜브영상ID"]).values()),
                         external_id_url_disagreements=sum(yt_id(r["원본영상URL"]) != r["유튜브영상ID"] for r in external),
                         external_runtime_matches=compared_external, excluded_external=len(excluded_external),
                         excluded_unique_youtube_ids=len(omitted_ids),
                         unique_all_candidate_ids=len(external_ids | omitted_ids),
                         verified_excluded_id_overlap=sorted(external_ids & omitted_ids),
                         institution_identifiable_youtube_ids=len(institution_yt_ids),
                         identifiable_id_overlap=sorted(institution_yt_ids & external_ids),
                         institution_underlying_content_overlap=UNKNOWN, live_availability=UNKNOWN,
                         runtime_video_total=current["counts"][3])

    keywords, keyword_rows = keyword_audit([
        ("올림픽 원본 전체", raw, "일련번호", "강좌명"),
        ("올림픽 2026년", year_data, "일련번호", "강좌명"),
        ("서비스 일반 검색", search_data, "일련번호", "강좌명"),
        ("기관 영상", institution, "순번", "제목"),
        ("외부 YouTube", external, "id", "영상제목"),
    ], current["runtimeKeywords"])

    distributions = []
    def distribution(dataset, axis, values):
        counts = Counter(values)
        total = sum(counts.values())
        distributions.extend(dict(dataset=dataset, axis=axis, value=value, count=count,
                                  total=total, pct=rate(count, total))
                             for value, count in sorted(counts.items()))

    distribution("올림픽 원본 전체", "수강월 연도", (str(parsed_year(r) or "파싱 실패") for r in raw))
    for name, rows in datasets:
        distribution(name, "수강월", (r["수강월"][:7] if date_value(r["수강월"]) else "파싱 실패" for r in rows))
        distribution(name, "원본 종목", (r["종목"] or "〈빈 문자열〉" for r in rows))
        distribution(name, "원본 수강요일 표기", (r["수강요일"] or "〈빈 문자열〉" for r in rows))
        distribution(name, "원본 수강대상 표기", (r["수강대상"] or "〈빈 문자열〉" for r in rows))
    for (source, phase), counts in course_class_totals.items():
        total = sum(counts.values())
        distributions.extend(dict(dataset=source, axis=phase, value=key, count=n, total=total, pct=rate(n, total))
                             for key, n in sorted(counts.items()))
    other_records = [row for row in classifications if row["source"] == "강좌" and row["before_field"] == "기타 운동"]
    distribution("기존 기타 운동 강좌", "근거 원본 종목", (row["original_sport"] for row in other_records))
    distribution("기존 기타 운동 강좌", "원본 강좌명", (row["title"] for row in other_records))
    distribution("기존 기타 운동 강좌", "재분류 분야", (row["after_field"] for row in other_records))
    distribution("기관 영상", "등록일", (r["등록일"] for r in institution))
    distribution("기관 영상", "첨부 콘텐츠 유형", types_by_id.values())
    distribution("외부 YouTube", "영상 분야", (r["관심분야"] for r in external))
    distribution("외부 YouTube", "표본 난이도", (r["영상난이도"] for r in external))

    facilities = tables["facilities"]["rows"]
    facility_type = "개방시설유형구분"
    distribution("전국 시설개방", facility_type, (r[facility_type] or "〈빈 문자열〉" for r in facilities))
    distribution("전국 시설개방", "데이터기준일 연도", (r["데이터기준일자"][:4] for r in facilities))
    def valid_coords(row):
        lat, lon = number(row["위도"]), number(row["경도"])
        return lat is not None and lon is not None and 33 <= lat <= 39 and 124 <= lon <= 132

    valid_facility_dates = [r["데이터기준일자"] for r in facilities if date_value(r["데이터기준일자"])]
    facility_summary = dict(total=len(facilities), columns=len(tables["facilities"]["header"]),
                            type_count=len({r[facility_type] for r in facilities}),
                            sport_type_candidates=sum(bool(SPORT_FACILITY.search(r[facility_type])) for r in facilities),
                            other_exact=sum(r[facility_type] == "기타" for r in facilities),
                            other_ambiguous_sports_hints=sum(r[facility_type] == "기타" and bool(
                                SPORT_FACILITY.search(r["개방시설명"] + " " + r["개방장소명"])) for r in facilities),
                            any_address=sum(bool(r["소재지도로명주소"].strip() or r["소재지지번주소"].strip())
                                            for r in facilities),
                            coordinates_in_bounds=sum(valid_coords(r) for r in facilities),
                            weekday_hours_both=sum(all(ONE_TIME.fullmatch(r[k].strip()) for k in
                                                       ("평일운영시작시각", "평일운영종료시각")) for r in facilities),
                            weekend_hours_both=sum(all(ONE_TIME.fullmatch(r[k].strip()) for k in
                                                       ("주말운영시작시각", "주말운영종료시각")) for r in facilities),
                            fee_text_present=sum(bool(r["사용료"].strip()) for r in facilities),
                            paid_flags=dict(Counter(r["유료사용여부"] for r in facilities)),
                            dated_rows=len(valid_facility_dates),
                            min_data_as_of=min(valid_facility_dates), max_data_as_of=max(valid_facility_dates))
    entire_catalog = tables["center_catalog"]["rows"]
    catalog = [r for r in entire_catalog if "분당" not in r["스포츠센터"]]
    catalog_dist = Counter(r["스포츠센터"] for r in catalog)
    distribution("스포츠센터 소개 CSV", "스포츠센터", (r["스포츠센터"] for r in catalog))
    catalog_name = lambda value: re.sub(r"\s+", "", unicodedata.normalize("NFC", value)).casefold()
    name_overlap = {catalog_name(r["강좌명"]) for r in catalog} & {catalog_name(r["강좌명"]) for r in service}
    sport_overlap = {catalog_name(r["강좌명"]) for r in catalog} & {catalog_name(r["종목"]) for r in service if r["종목"]}
    catalog_summary = dict(file_rows=len(entire_catalog), audited_rows=len(catalog),
                           columns=len(tables["center_catalog"]["header"]),
                           centers=dict(catalog_dist), normalized_title_overlap=len(name_overlap),
                           normalized_catalog_title_to_service_sport_overlap=len(sport_overlap))

    class_summary = {f"{source}:{phase}": dict(counts) for (source, phase), counts in course_class_totals.items()}
    class_summary["prior_audit_runtime_disagreements"] = sum(not r["previous_audit_matches_runtime"] for r in classifications)
    class_summary["old_other_title_distinct"] = len({r["title"] for r in other_records})
    class_summary["old_other_redistribution"] = dict(Counter(r["after_field"] for r in other_records))
    class_summary["search_field_counts"] = dict(Counter(row["search_field"] for row in classifications
                                                      if row["source"] == "강좌"))
    course_titles = groups([row for row in classifications if row["source"] == "강좌"], ("title",))
    class_summary["same_title_different_after_classification"] = [
        {"title": title[0], "ids": [row["id"] for row in group]}
        for title, group in course_titles.items()
        if len({(row["after_field"], row["after_sport"]) for row in group}) > 1
    ]
    class_summary["initial_course_rows_requiring_review"] = [
        dict(id=r["id"], status=r["audit_state"], title=r["title"]) for r in classifications
        if r["source"] == "강좌" and r["before_field"] == "분류 확인 필요"]
    quality_duplicates = {f"{r['dataset']}:{r['key']}": r for r in duplicates}
    original_duplicates = lambda k, metric: quality_duplicates[f"올림픽 원본 전체:{k}"][metric]
    year_duplicates = lambda k, metric: quality_duplicates[f"올림픽 2026년:{k}"][metric]
    full_quality = quality["올림픽 원본 전체"]
    year_quality = quality["올림픽 2026년"]
    metric_refs = [
        ("강좌 원본 행", 2137, len(raw), "file_inventory.csv"),
        ("강좌 원본 열", 13, len(original_columns), "file_inventory.csv"),
        ("2026년 수강월", 400, len(year_data), "distribution_comparison.csv"),
        ("2026년 이전", 1737, matching["before_2026"], "summary.json → matching"),
        ("전체 고유 강좌일련번호", 1386, original_duplicates("강좌일련번호", "distinct"), "duplicate_analysis.csv"),
        ("2026년 고유 강좌일련번호", 385, year_duplicates("강좌일련번호", "distinct"), "duplicate_analysis.csv"),
        ("전체 고유 강좌일련+서브일련번호", 2137,
         original_duplicates("강좌일련번호+강좌서브일련번호", "distinct"), "duplicate_analysis.csv"),
        ("전체 고유 강좌명", 448, original_duplicates("강좌명", "distinct"), "duplicate_analysis.csv"),
        ("전체 완전 중복 제거 대상", 0, original_duplicates("완전 동일", "duplicate_excess"), "duplicate_analysis.csv"),
        ("전체 수강대상 결측", 1891, full_quality["missing_수강대상"], "missing_values.csv"),
        ("전체 수강대상 결측률(%)", 88.49, round(rate(full_quality["missing_수강대상"], len(raw)), 2), "missing_values.csv"),
        ("2026년 수강대상 결측", 364, year_quality["missing_수강대상"], "missing_values.csv"),
        ("2026년 수강대상 결측률(%)", 91, rate(year_quality["missing_수강대상"], len(year_data)), "missing_values.csv"),
        ("종목 결측", 1, full_quality["missing_종목"], "missing_values.csv"),
        ("수강금액 결측", 1, full_quality["missing_수강금액"], "missing_values.csv"),
        ("전체 특수 종료일", 1344, full_quality["sentinel_end"], "quality_issues.csv"),
        ("2026년 특수 종료일", 380, year_quality["sentinel_end"], "quality_issues.csv"),
        ("2026년 일반 종료일", 20, year_quality["ordinary_end"], "quality_issues.csv"),
        ("전체 제목 입문 표현(요청 규칙)", 96, keywords["올림픽 원본 전체"]["korean_or_english"], "beginner_keyword_matches.csv"),
        ("2026년 제목 입문 표현(요청 규칙)", 29, keywords["올림픽 2026년"]["korean_or_english"], "beginner_keyword_matches.csv"),
        ("기관 영상 기록", 56, len(institution), "video_audit.csv"),
        ("기관 고유 링크", 56, video_summary["institution_link_unique"], "duplicate_analysis.csv"),
        ("기관 고유 제목", 55, video_summary["institution_title_unique"], "duplicate_analysis.csv"),
        ("기관 완전 중복 제거 대상", 0, video_summary["institution_full_duplicate_excess"], "duplicate_analysis.csv"),
        ("기관 한글 입문 표현", 0, keywords["기관 영상"]["korean"], "beginner_keyword_matches.csv"),
        ("기관 Beginner", 1, keywords["기관 영상"]["english"], "beginner_keyword_matches.csv"),
        ("외부 YouTube 영상", 131, len(external), "video_audit.csv"),
        ("전체 서비스 영상", 187, current["counts"][3], "summary.json → video"),
        ("일반 검색 대상", 399, len(eligible), "search_exclusion_analysis.csv"),
        ("기존 기타 운동", 348, len(other_records), "classification_comparison.csv"),
        ("전국공공시설개방", 7333, len(facilities), "file_inventory.csv"),
    ]
    metrics = [dict(metric=label, previously_reported=reported, computed=actual,
                    verification="일치" if reported == actual else "차이",
                    difference=actual-reported, evidence=source) for label, reported, actual, source in metric_refs]
    after = {str(t["path"]): sha(t["path"]) for t in tables.values()}
    unchanged = all(after[str(t["path"])] == t["sha"] for t in tables.values())
    visited_code_unchanged = all(sha(Path(path)) == digest for path, digest in watched.items())
    git_service_unchanged = not git("diff", SERVICE_BASE, "--name-only", "--", "Frontend", "Backend", ".github", ".maestro").strip()
    if not (unchanged and visited_code_unchanged and git_service_unchanged):
        raise RuntimeError("원본 또는 서비스 파일 변경을 감지했습니다.")

    source_url = "https://www.data.go.kr/data/"
    olympic_url = source_url + "15110953/fileData.do"
    institution_url = source_url + "15119388/fileData.do"
    def meta(url, filename_date, registered, modified, lineage, provider=PROVIDER):
        return provider, url, filename_date, registered, modified, lineage

    meta_rows = {
        "olympic": meta(olympic_url, "2026-06-01", "2026-06-29", "2026-09-21", "공공데이터포털 원문"),
        "service_courses": meta(olympic_url, "", "", "", "수강월 2026년 + 12개 파생값. sample-data.ts:2, search.ts:12"),
        "institution_raw": meta(institution_url, "2022-06-29", "2026-09-21", "2026-09-30", "공공데이터포털 원문"),
        "institution_attachment": meta(institution_url, "2022-06-29", "2026-09-21", "2026-09-30", "사용자 제공 원본"),
        "institution": meta(institution_url, "", "", "", "sample-data.ts:10805, search.ts:31"),
        "external": meta("https://www.youtube.com/", "", "", "", "검증 보고서 및 external-videos.ts:1", "각 YouTube 게시 채널"),
        "excluded_external": meta("https://www.youtube.com/", "", "", "", "검증 보고서, 서비스 수록 제외", "각 YouTube 게시 채널"),
        "prior_audit": meta("", "", "", "", "Git 924bc8b 당시 행별 검토, public-data-analysis.ts:75 및 :151", "MOVEBRIDGE 검토"),
        "center_catalog": meta(source_url + "15147992/fileData.do", "2026-08-25", "2026-08-25", "2026-09-22",
                               "별도 강좌 소개 목록, App.tsx:252"),
        "facilities": meta(source_url + "15013117/standard.do", "", "2019-07-04", "2026-09-10",
                           "사용자 첨부본. 시설 기준일은 행별 컬럼", "지방자치단체 등 행별 제공기관"),
    }
    for key in ("full_converted", "year_converted", "search_attachment"):
        meta_rows[key] = meta(olympic_url, "", "", "", "2026-11-22 전처리 품질 문서와 파일 대조")

    usability = [
        ("일반 강좌 검색", "2026년 399건 유지", "수강월 2026년, 기존 검색 제외 적용", "실제 모집·실시간 정원·센터별 신청 URL 별도 조회"),
        ("과거 기록 분석", "2,137건 분석 가능", "수강월·원본 종목·기간별 기록 분포", "동일 강좌 반복과 1990년 기록 별도 표시. 신청자·수요 추정 근거 없음"),
        ("종목 분포", "가능", "원본 종목과 파생 상위 분야를 함께 보존", "과거 신규 표기·복합 프로그램은 별도 검토"),
        ("데이터 품질", "가능", "결측·일련번호·날짜·금액·시간 및 출처 대조", "의미 미확인은 데이터 제공기관 질의"),
        ("입문 표현 분석", "가능", "제목 키워드 집계 및 서비스 규칙과 구분", "난이도·적합성은 제목만으로 판정 불가"),
        ("온라인·오프라인 연계", "종목 수준 가능", "세부 종목 및 출처 구분으로 비교", "공통 식별키 확보 전 동일 프로그램 연결 근거 부족"),
        ("현재 운영 및 신청 안내", "공식 최신 자료 필요", "특수 종료일은 기관 등록 관행", "센터별 운영 중·잔여석·신청주소 직접 확인"),
        ("지역 공공운동시설 탐색", "향후 별도 보조 자료", "유형, 주소·좌표, 운영시간, 사용료", "유형 정규화 및 행별 기준일 확인. 시설 대관과 강좌 신청 구분"),
    ]
    summary = dict(context=dict(branch=branch, base_branch="feat/onboarding", base_commit=base_commit,
                                preclassification_commit=BEFORE_CLASSIFICATION,
                                analysis_executed_kst=datetime.now(SEOUL).isoformat(timespec="seconds"),
                                as_of=args.as_of.isoformat(), python=platform.python_version(),
                                node=subprocess.check_output(["node", "-v"], text=True).strip(),
                                libraries="Python 표준 라이브러리 및 Node.js 내장 TypeScript 처리",
                                new_worktree=False),
                   matching=matching, search=search_summary, quality={key: dict(value) for key, value in quality.items()},
                   duplicate_title_variation=title_repeats,
                   classification=class_summary, video=video_summary, beginner_title=keywords,
                   facilities=facility_summary, center_catalog=catalog_summary, metrics=metrics,
                   integrity=dict(csv_sha256_unchanged=unchanged, read_service_files_sha256_unchanged=visited_code_unchanged,
                                  git_service_files_unchanged=git_service_unchanged,
                                  input_hashes={public_input_location(key, table["path"]): after[str(table["path"])]
                                                for key, table in tables.items()},
                                  audited_service_hashes={Path(path).relative_to(ROOT).as_posix(): digest
                                                          for path, digest in watched.items()}))
    output.mkdir(parents=True, exist_ok=False)
    csv_out(output, "file_inventory.csv", list(inventory(tables, after, args.as_of, meta_rows)), redact)
    csv_out(output, "metric_verification.csv", metrics, redact)
    csv_out(output, "record_matching.csv", matches, redact)
    csv_out(output, "unmatched_records.csv", unmatched, redact, ["side", "serial", "month", "title", "reason"])
    csv_out(output, "duplicate_analysis.csv", duplicates, redact)
    profiles = [r for name, rows in datasets for r in missing_profile(name, rows, list(rows[0]))]
    profiles.extend(r for key, t in tables.items() if key not in {"service_courses", "olympic", "center_catalog"}
                    for r in missing_profile(key, t["rows"], t["header"]))
    profiles.extend(missing_profile("center_catalog_scoped", catalog, tables["center_catalog"]["header"]))
    csv_out(output, "missing_values.csv", profiles, redact)
    csv_out(output, "quality_issues.csv", issues, redact)
    csv_out(output, "classification_comparison.csv", classifications, redact)
    csv_out(output, "search_exclusion_analysis.csv", search_rows, redact,
            ["id", "title", "original_sport", "eligibility", "resolution", "reason", "data_quality", "code"])
    csv_out(output, "distribution_comparison.csv", distributions, redact)
    csv_out(output, "video_audit.csv", video_rows, redact)
    csv_out(output, "beginner_keyword_matches.csv", keyword_rows, redact)
    csv_out(output, "usability_assessment.csv", [dict(purpose=p, status=s, basis=b, prerequisite=n)
                                               for p, s, b, n in usability], redact)
    (output / "summary.json").write_text(
        json.dumps(public_value(summary, redact), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{output}\n기존 보고값 대조 {len(metrics)}개, 차이 {sum(r['verification'] == '차이' for r in metrics)}개")


if __name__ == "__main__":
    main()
