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
- Only `종목=방학특강` plus the explicit `방특 배민` phrase is interpreted as badminton (`inferred`, not official abbreviation confirmation). This approved display/search alias covers two records, keeps the original title/sport untouched, and carries a disclosure in the card/modal. Other holiday sports are not blanket-reclassified. Original-wording analysis intentionally does not incorporate this unverified alias.

## Field and experience discovery

- `external-videos.ts` contains display fields from the 131 included rows of `movebridge_youtube_verified.csv`. The 69 excluded rows are outside the app dataset. Only official YouTube watch links and original thumbnail URLs are used. The difficulty, confidence, observation interval and evidence describe the sampled segment documented in the verification report.
- External records use the CSV field and discipline. The experience filter matches `입문·기초` for `처음 시작` and `중급` or `고급` for `운동 경험 있음`. `상관없음` includes all levels, including `판단 보류` and `여러 수준 혼합`. Public-data charts and their title-based analysis continue to use the 56 institution records.

- `discovery.ts` adds presentation-only classification, keyword evidence, filtering, grouping and ordering around the unchanged `search.ts` filters.
- Course classification checks explicit sport text first, then the original title. Registration wording `헬스등록필수` is not sport evidence. Unknown branded programs stay `분류 확인 필요`; they are not silently assigned to strength or flexibility.
- Videos use the supplied `관심분야`; `검토 필요` and `운동 외 콘텐츠` are not reassigned. Shared fields do not identify a course/video pair.
- Only original titles are analyzed because no description field is connected in either sample. Evidence is `입문`, `초급`, `기초`, or the whole English word `Beginner` (case-insensitive). `기초체력`, `기초대사량`, and mixed level expressions such as `초.중급` or `초급/중급` do not establish introductory wording.
- First-time experience + default sort groups positive title evidence first without removing other matches. Explicit price/time sorts override this priority; online metadata never receives offline weekday/time/budget filters.
- Classification totals include unclassified and non-sport records, and cover exactly the existing 400 offline / 56 online samples.

## Source provenance clarification

The user reports that `한국체육산업개발주식회사_올림픽스포츠센터 강좌정보_20260601.csv` is CP949, has 2,137 total rows, and its 400 records with a 2026 course month match the current sample's 13 original fields. The complete original CSV and its official portal URL are not present in this repository. These claims are therefore labelled as user-confirmed provenance, not independently revalidated facts. The existing 94-row sports-center introduction dataset URL is a separate reference, not the source link of the 400 searchable records.

Run the focused data checks with:

```sh
node --experimental-strip-types --test src/data/search.test.mjs
node --experimental-strip-types --test src/data/discovery.test.mjs
```
