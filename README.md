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
