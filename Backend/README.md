# MOVEBRIDGE Backend

Supabase Auth 사용자와 연결되는 프로필 및 북마크의 초기 PostgreSQL 스키마입니다.
현재 시간표는 강좌 북마크와 강좌 데이터에서 계산합니다.

## 로컬 검증

Docker 엔진과 Supabase CLI를 사용할 수 있는 환경에서 이 디렉터리를 작업 루트로 사용합니다.
CLI 3.4.0에서 검증했습니다.

```sh
cd Backend
supabase start
supabase migration up --local
supabase test db
```

테스트는 로컬 PG17에서 가상 사용자를 준비하고, 서로 다른 JWT `sub`를 사용해
`authenticated`와 `anon` 역할의 접근을 검증합니다. 테스트 픽스처는 트랜잭션 종료 시 롤백합니다.
Auth HTTP 회원가입은 별도로 호출해 기본 프로필 생성을 확인할 수 있습니다. 이메일 확인과 UI 인증 흐름은 인증 연동 단계의 검증 항목입니다.

## 데이터와 권한

- `profiles`는 Auth 유저 추가 시 생성됩니다. 로그인한 사용자는 자신의 프로필을 읽고 이름을 수정할 수 있습니다.
- `bookmarks`는 로그인한 사용자가 자신의 항목을 조회·추가·삭제할 수 있습니다.
  `(user_id, content_key)` 고유 인덱스가 중복을 막고 사용자별 조회를 지원합니다.
- 계정이 삭제되면 연결된 프로필과 북마크도 삭제됩니다.
- 콘텐츠 키 예시는 `course:institution:42`, `video:institution:42`, `video:youtube:MB-C001`입니다.
  외부 영상에는 현재 목록의 `id` 필드를 사용합니다. 키 검사 제약은 형식을 검증합니다.
  공급처의 ID 재부여나 실제 콘텐츠의 존재 여부는 별도의 데이터 갱신 정책이 필요합니다.
