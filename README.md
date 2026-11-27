# MOVEBRIDGE

```sh
cd Frontend
pnpm install --frozen-lockfile
pnpm dev
```

- 테스트는 `node --test src/data/*.test.mjs src/auth/*.test.mjs src/features/*/*.test.mjs`로 실행합니다.
- 타입 검사는 `pnpm exec tsc --noEmit`으로 실행합니다.
- 프로덕션 빌드는 `pnpm build`로 생성합니다.
- 원본 CSV와 영상 검증 보고서는 `Frontend/data/original/`에 있습니다.

## 나의 운동 첫걸음

로드맵은 기존 종목 분류를 바탕으로 세부 종목 일치, 종목 추정 일치, 같은 관심 분야 순으로
영상과 강좌를 보여줍니다. 각 그룹 안에서는 「처음 시작」을 선택하면 제목의 입문 표현과 외부 영상의
입문·기초 표본 평가를, 「운동 경험 있음」을 선택하면 외부 영상의 중급·고급 표본 평가를 먼저 보여줍니다.
그 외에는 기존 자료 순서를 따릅니다. 입문 표현과 표본 평가는 탐색 순서에만 사용합니다.

운동 외 콘텐츠와 종목 확인이 필요한 자료는 로드맵에서 제외합니다. 원본 강좌 400건,
일반 검색 대상 399건, 기관 영상 56건, 외부 영상 131건은 기존 데이터에서 모두 유지합니다.
로드맵의 선택 조건과 단계는 현재 앱 탭에서 유지합니다. 로그인한 사용자의 북마크와 일정은
기존 계정 저장 기능을 사용합니다.

## GitHub Actions와 Maestro 웹 테스트

[CI](.github/workflows/ci.yml)는 `main` 대상 PR, `main` 푸시, 수동 실행에서 프론트엔드와
Supabase 검사를 두 작업으로 실행합니다. 프론트엔드는 Node.js 22와 pnpm 10.34.3을 사용합니다.
Supabase CLI 3.4.0은 CI 러너의 로컬 Postgres에서 마이그레이션과 pgTAP 테스트를 실행합니다.

[Maestro web smoke](.github/workflows/maestro-web.yml)는 수동 워크플로입니다. 워크플로가 기본
브랜치에 추가되면 **Actions → Maestro web smoke → Run workflow**에서 실행할 수 있습니다.
실행 결과에는 JUnit 보고서, 테스트 로그와 실패 화면, Vite preview 로그가 첨부됩니다.
[GitHub 수동 실행 조건](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

로컬에서 Java 21과 [공식 Maestro CLI 2.12.1](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.12.1)을
준비하고, 저장소 루트에서 공개 기능용 프로덕션 빌드와 미리보기를 실행합니다.

```sh
pnpm --dir Frontend install --frozen-lockfile
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= pnpm --dir Frontend build
pnpm --dir Frontend preview --host 127.0.0.1 --port 4175 --strictPort
```

같은 디렉터리의 다른 터미널에서 검사를 실행합니다.

```sh
maestro test --headless --screen-size 1440x1000 .maestro/web
```

네 흐름은 홈페이지·관심 운동 검색, 공공데이터 현황·분석 차트, 서비스 소개, 운동 첫걸음과 시간표 연결을 확인합니다.
공식 웹 모드는 Chromium 기반이며 첫 실행에서 브라우저 드라이버 준비 시간이 추가될 수 있습니다.
[Maestro 웹 테스트 문서](https://docs.maestro.dev/get-started/supported-platform/web-browser)
