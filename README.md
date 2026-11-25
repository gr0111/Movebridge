# MOVEBRIDGE

무브릿 React 프로젝트는 `Frontend/`에 있습니다.

```sh
cd Frontend
pnpm install --frozen-lockfile
pnpm dev
```

- 테스트는 `node --test src/data/*.test.mjs src/auth/*.test.mjs src/features/*/*.test.mjs`로 실행합니다.
- 타입 검사는 `pnpm exec tsc --noEmit`으로 실행합니다.
- 프로덕션 빌드는 `pnpm build`로 생성합니다.
- 원본 CSV와 영상 검증 보고서는 `Frontend/data/original/`에 있습니다.

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

세 흐름은 홈페이지·관심 운동 검색, 공공데이터 현황·분석 차트, 서비스 소개를 확인합니다.
공식 웹 모드는 Chromium 기반이며 첫 실행에서 브라우저 드라이버 준비 시간이 추가될 수 있습니다.
[Maestro 웹 테스트 문서](https://docs.maestro.dev/get-started/supported-platform/web-browser)
