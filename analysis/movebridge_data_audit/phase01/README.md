# MOVEBRIDGE 공공데이터 원본 감사

올림픽스포츠센터 원본과 서비스 강좌의 관계, 일반 검색 제외 조건, 분류·영상·제목 키워드 품질을 검증한다. 전국 시설개방 자료는 지역 시설 탐색의 보조 자료로 검토했다. 분당 단독 강좌 파일과 다센터 강좌 소개의 분당 행은 분석 범위에서 제외했다.

- [감사 보고서](audit_report.md)
- [주요 지표와 무결성 확인](results_2026-11-25/summary.json)
- [기존 보고값 31개 대조](results_2026-11-25/metric_verification.csv)

## 원본 출처와 확보 방법

| 입력 | 확보 방법 |
|---|---|
| 올림픽스포츠센터 강좌 원본 `20260601` (2,137행) | 저장소의 기존 `Frontend/data/original/` 파일을 사용한다. 새로 확보할 경우 제공 포털에서 같은 파일 버전을 내려받는다. [공공데이터포털 15110953](https://www.data.go.kr/data/15110953/fileData.do) |
| 기관 온라인 강습 영상 원본 `20220629` (56행) | 저장소에 있는 기존 원본을 사용한다. 별도 첨부본 대조에는 같은 버전을 분석 입력 폴더에 놓는다. 첨부본을 별도로 확보할 수 없으면 기존 저장소 파일의 사본으로 재현할 수 있다. [공공데이터포털 15119388](https://www.data.go.kr/data/15119388/fileData.do) |
| 스포츠센터 강좌 소개 `20260825` (94행) | 파일데이터 페이지에서 해당 버전의 CSV를 확보해 분석 입력 폴더에 놓는다. [공공데이터포털 15147992](https://www.data.go.kr/data/15147992/fileData.do) |
| 전국공공시설개방정보표준데이터 (7,333행) | 표준데이터 페이지에서 전국 단위 CSV를 확보한다. 저장본이 바뀌면 [파일 목록](results_2026-11-25/file_inventory.csv)의 SHA-256과 일치하는 과거 사본을 제공기관 또는 프로젝트 자료 보관처에서 확보한다. [공공데이터포털 15013117](https://www.data.go.kr/data/15013117/standard.do) |
| 기존 서비스 데이터 및 비교 자료 | 같은 커밋의 `Frontend/data/original/`에 있는 검색 가공본, 기관 영상 가공본, YouTube 검증본·제외본과 `Frontend/data/audit/`의 기존 분류 비교표를 사용한다. 외부 영상의 수록 기준은 [기존 검증 보고서](../../../Frontend/data/original/movebridge_youtube_verification_report.md)를 따른다. |
| 과거 전처리 산출물 3개 | `sports_step_all_2026source.csv`, `sports_step_courses_2026.csv`, 별도 `sports_step_search_2026.csv`는 기존 프로젝트의 전처리 보관 자료다. 이 파일들이 분석 입력 폴더에 있으면 추가 대조한다. |

원본은 파일 목록에 기록된 이름과 SHA-256으로 식별한다. 포털에 최신 파일만 보일 때는 목록의 해시와 일치하는 저장본을 사용해야 당시 집계를 재현할 수 있다. 저장소에 없는 원본과 별도 사본은 저장소 밖의 입력 폴더에 둔다. 파일 목록의 `source-dir/`은 그 입력 폴더를 가리킨다. 나머지 경로는 저장소 루트 기준이다.

## 재실행

저장소 루트에서 실행한다. Python 3.9.6 표준 라이브러리와 Node.js 22.19.0의 TypeScript 직접 실행을 사용했다. 개발 의존성 설치, DB 연결, 외부 영상 요청은 필요 없다. 역사적 분류 함수는 Git 커밋에서 읽는다. 동일한 결과를 재현하려면 서비스 기준 커밋 `3a6316a20046f34d4cde847612dcc96d37735eb2`와 그 이력을 사용한다.

```sh
python3 -B analysis/movebridge_data_audit/phase01/audit.py \
  --source-dir "${MOVEBRIDGE_SOURCE_DIR:?Set MOVEBRIDGE_SOURCE_DIR to the source-data folder}" \
  --as-of 2026-11-25 \
  --out analysis/movebridge_data_audit/phase01/results_rerun
```

`--as-of`는 종료일 비교의 기준일이다. 실제 실행 시각은 서울 시간으로 별도 저장한다. 결과 경로는 새 디렉터리를 지정한다.

CSV는 UTF-8 BOM으로 작성한다. 입력은 UTF-8 계열을 먼저 검사하고 실패하면 CP949로 읽는다. 헤더 중복이나 열 개수 오류가 있으면 실행을 중단한다. 입력 CSV와 조회한 서비스 파일의 전후 해시를 비교한다. 공개본은 강좌명에 포함된 강사 이름을 마스킹하고, 스프레드시트가 수식으로 해석할 수 있는 텍스트에 작은따옴표를 붙인다. 공개 처리 전 원본 값으로 모든 집계와 대조를 수행한다.

## 결과물

| 파일 | 내용 |
|---|---|
| [file_inventory.csv](results_2026-11-25/file_inventory.csv) | 출처, 날짜 구분, 파일 크기, 인코딩, 해시, 열·자료형, 사용 코드 |
| [metric_verification.csv](results_2026-11-25/metric_verification.csv) | 기존 보고값과 실제 계산값 |
| [record_matching.csv](results_2026-11-25/record_matching.csv) | 서비스 400행의 원본 대응, 비교 방식, 차이 필드 |
| [unmatched_records.csv](results_2026-11-25/unmatched_records.csv) | 일대일 확정 대응이 없는 원본과 서비스 기록 |
| [duplicate_analysis.csv](results_2026-11-25/duplicate_analysis.csv) | 반복 그룹 수, 그룹 포함 행 수, 중복 초과 행 수와 고유값 |
| [missing_values.csv](results_2026-11-25/missing_values.csv) | 열별 공란·공백·NULL·의미상 결측 후보 및 분모 |
| [quality_issues.csv](results_2026-11-25/quality_issues.csv) | 날짜·금액·시간·종목 관련 품질 플래그와 검토 후보 |
| [classification_comparison.csv](results_2026-11-25/classification_comparison.csv) | 강좌·기관 영상 행별 이전·현재 분류와 근거 |
| [search_exclusion_analysis.csv](results_2026-11-25/search_exclusion_analysis.csv) | 기본 검색에서 제외한 행과 실제 서비스 규칙 |
| [distribution_comparison.csv](results_2026-11-25/distribution_comparison.csv) | 강좌 연·월, 종목, 분류, 출처별 영상 및 시설 유형 분포 |
| [video_audit.csv](results_2026-11-25/video_audit.csv) | 기관 56행 및 외부 131행, 제목·링크·분류·검토 근거 |
| [beginner_keyword_matches.csv](results_2026-11-25/beginner_keyword_matches.csv) | 제목 키워드 포함 행, 기존 서비스 판별 결과와 차이 |
| [usability_assessment.csv](results_2026-11-25/usability_assessment.csv) | 용도별 데이터 사용 가능 범위와 확인 조건 |
| [summary.json](results_2026-11-25/summary.json) | 종합 지표, 입력 경로·해시, 분석 환경 |
| [audit.py](audit.py) | 분석과 표 생성 코드 |
