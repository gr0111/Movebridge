# Attached MOVEBRIDGE samples

- `sample-data.ts` preserves all original field names and string values from the attached UTF-8 CSVs: `sports_step_search_2026.csv` (400 rows) and `sports_step_videos.csv` (56 rows). These are UI-review samples, not the complete service dataset.
- `search.ts` derives display and filtering values without rewriting course titles, video titles, raw weekday/time strings, dates, categories, or content-review states.
- The attached dictionary describes an earlier 94-course dataset with center names and URLs. Those fields are absent from the attached 400-row offline CSV and are not synthesized or joined into these records.
- Missing sport/audience values display as `미기재`. Audience is never inferred from the course title.
- Weekday filters require every selected day in `요일_기본표기`. Parenthetical days remain visible in the original `수강요일` string but are excluded from filtering, charts, and timetable placement.
- Fees are public-data amounts, not monthly fees. Capacity is not availability and is not displayed as remaining seats. The special end date `9999-12-31` is not treated as current operation.
- Video URLs are the original `영상링크`. Their reachability and contents have not been verified. Related-field videos are separate from direct matches and do not establish course identity.
- All charts are aggregates of attached samples only. Weekday counts can overlap across days.
- General course search uses `courseEligibility`: the raw 400 rows are retained, but 1 row (`자유이용`, sport missing and no sport identifiable in its title) is excluded by default, leaving 399 searchable records. This is not a claim that it is definitively a facility pass. Confirmed-sport access records and holiday programs are not blanket-excluded.
- `course-pagination.ts` defines an initial nine-record prefix and a separate +21 load-more increment shared by ordinary and beginner-grouped course results. Raw charts still include all 400 records; the analysis page separately discloses the searchable/excluded counts and reasons.
- Only `종목=방학특강` plus the explicit `방특 배민` phrase is interpreted as badminton. This approved display/search alias covers two records and carries a disclosure in the cards, details and public-data breakdown. The audit marks both records as inferred and records that official abbreviation confirmation is pending.

## Field and experience discovery

- `external-videos.ts` contains display fields from the 131 included rows of `movebridge_youtube_verified.csv`. The 69 excluded rows are outside the app dataset. Only official YouTube watch links and original thumbnail URLs are used. The difficulty, confidence, observation interval and evidence describe the sampled segment documented in the verification report.
- External records use the CSV field and discipline. The experience filter matches `입문·기초` for `처음 시작` and `중급` or `고급` for `운동 경험 있음`. `상관없음` includes all levels, including `판단 보류` and `여러 수준 혼합`. Public-data charts and their title-based analysis continue to use the 56 institution records.

- `discovery.ts` uses the existing search interest fields, including `기타 운동`. `public-data-analysis.ts` resolves the course discipline and expands the chart groups. The search rolls the expanded groups back into the existing interest fields.
- Course classification uses exact source sport names and explicit aliases first. When the sport field lacks a discipline, one complete sport term in the original title can establish the discipline. Multiple sport names with no source-field tie-breaker require review. `헬스등록필수` is a registration condition. `바디슬림`, `바디 트레이닝` and `자유이용` require more evidence.
- Institution video search retains the supplied `관심분야`. The public chart uses that topic as the baseline, then accounts for explicit registration notices and the K-POP promotional title under `운동 외 콘텐츠`. Title evidence identifies the discipline within the established topic. When a title identifies multiple strokes, the chart counts one swimming record. The golf-distance strength video counts as strength training based on its explicit activity and supplied field.
- Only original titles are analyzed because no description field is connected in either sample. Evidence is `입문`, `초급`, `기초`, or the whole English word `Beginner` (case-insensitive). `기초체력`, `기초대사량`, and mixed level expressions such as `초.중급` or `초급/중급` do not establish introductory wording.
- First-time experience + default sort groups positive title evidence first without removing other matches. Explicit price/time sorts override this priority; online metadata never receives offline weekday/time/budget filters.
- Classification totals include unclassified and non-sport records, and cover exactly the existing 400 offline / 56 online samples.
- [검토 기록과 변경 전후 집계](../../data/audit/README.md)

## Source provenance clarification

The attached CP949 course CSV contains 2,137 total rows. Its 400 records with a 2026 course month match the current sample's original fields by `일련번호`, with an integer-versus-decimal string difference in the representation of the same fee amount. The attached CP949 video CSV contains 56 matching video records. The 94-row sports-center introduction dataset URL is a separate reference.

Run the focused data checks with:

```sh
node --experimental-strip-types --test src/data/search.test.mjs
node --experimental-strip-types --test src/data/discovery.test.mjs
```
