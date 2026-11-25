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
Auth HTTP 회원가입으로 기본 프로필 생성을 별도로 검증할 수 있습니다.

## 이메일 인증 연동

### 로컬 개발

1. `Backend/`에서 위 명령으로 Supabase를 실행합니다. 이미 실행 중인 로컬 스택에 이메일 설정을
   변경했다면 해당 로컬 스택을 중지하고 다시 시작합니다.
2. 로컬 CLI가 표시하는 Project URL과 **Publishable Key**를 `Frontend/.env.local`에 넣습니다.
   변수 이름은 `Frontend/.env.example`과 같습니다. Secret Key와 Service Role Key는
   프론트엔드 환경변수에 사용하지 않습니다.
3. `Frontend/`에서 `pnpm install --frozen-lockfile`과 `pnpm dev`를 실행합니다.
   앱 주소는 `http://127.0.0.1:8443/`, 로컬 Mailpit 기본 주소는
   `http://127.0.0.1:54324/`입니다. 사용자 지정 포트를 사용한다면 CLI 출력과
   `supabase/config.toml`의 허용 리디렉션 주소를 확인합니다.
4. 가입 후 Mailpit에서 확인 메일을 열고 앱에서 확인 버튼을 누릅니다.
   확인 전 로그인은 차단되고, 확인 후 로그인과 새로고침 시 세션 복원이 되는지 확인합니다.
   비밀번호 찾기를 요청한 뒤 Mailpit에서 재설정 메일을 엽니다. 재설정 확인 버튼을 누르고
   새 비밀번호를 설정해 기존 비밀번호가 거절되고 새 비밀번호로 로그인되는지 확인합니다.

### Supabase Cloud와 Vercel에서 직접 설정할 항목

1. Supabase 프로젝트를 생성합니다. 대시보드의 Connect 또는 API Keys 메뉴에서
   **Project URL**과 **Publishable Key**를 확인합니다.
2. 원하는 프로젝트가 맞는지 확인하고, 검토한 SQL을 순서대로 적용합니다.
   예를 들어 대시보드 SQL Editor에서
   `supabase/migrations/20261125000000_member_profiles_and_bookmarks.sql`을
   한 번만 실행합니다. 이미 적용한 프로젝트에서는 같은 마이그레이션을 다시 실행할 필요가 없습니다.
3. Auth의 Email 공급자에서 이메일 가입을 허용하고 **Confirm email**을 켭니다.
   URL Configuration의 **Site URL**은 배포 앱 주소로 설정합니다. Redirect URLs에는
   앱이 보내는 실제 주소를 등록합니다. 예를 들어 `https://your-app.vercel.app/?auth=confirm`과
   `https://your-app.vercel.app/?auth=recovery`입니다.
   로컬과 테스트 배포 주소가 필요하다면
   사용하는 주소만 추가합니다.
4. Auth Email Templates의 **Confirm signup**에 `supabase/templates/confirmation.html`,
   **Reset password**에 `supabase/templates/recovery.html`의 내용을 넣습니다.
5. Vercel의 프로젝트 Root Directory는 `Frontend`로 선택하고,
   `VITE_SUPABASE_URL` 및 `VITE_SUPABASE_PUBLISHABLE_KEY`를 Production과 필요한
   Preview 환경에 입력한 뒤 다시 배포합니다. 실제 값은 저장소에 커밋하지 않습니다.
6. 운영에서 일반 사용자에게 메일을 발송하려면 **Custom SMTP**를 설정하고 실제 받은편지함에서
   가입 확인과 재설정 흐름을 점검합니다. 공급자의 링크 추적은 인증 메일에서 끕니다.

가입 확인과 재설정 링크는 이메일 템플릿의 `TokenHash`를 URL 프래그먼트로 전달합니다. 프래그먼트는 앱 호스팅
서버 요청에 포함되지 않으며, 페이지가 읽은 뒤 주소에서 지웁니다. 화면에서 사용자가 확인 버튼을
누르면 SDK의 `verifyOtp`를 호출합니다. 따라서 이메일을 다른 브라우저에서 열어도 기존 브라우저의
PKCE 검증 코드나 별도 라우터가 필요하지 않습니다. 복구 세션은 메모리에 유지하고, 변경이
완료되면 복구 세션을 정리하고 일반 로그인 화면으로 돌아갑니다. 복구 도중 새로고침해 링크가
이미 사용된 경우에는 새 재설정 메일을 요청합니다.

공식 참고 문서

- [Supabase 이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase 리디렉션 URL](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Vercel 환경변수](https://vercel.com/docs/environment-variables)

## 데이터와 권한

- `profiles`는 Auth 유저 추가 시 생성됩니다. 로그인한 사용자는 자신의 프로필을 읽고 이름을 수정할 수 있습니다.
- `bookmarks`는 로그인한 사용자가 자신의 항목을 조회·추가·삭제할 수 있습니다.
  `(user_id, content_key)` 고유 인덱스가 중복을 막고 사용자별 조회를 지원합니다.
- 프론트엔드는 로그인한 회원의 강좌 북마크를 조회해 기존 시간표를 구성합니다. 비회원 북마크는
  메모리에만 남고 로그인 시 자동 이전하지 않습니다.
- 현재 강좌와 연결되지 않는 북마크는 시간표에 개수를 안내하고 DB 행을 보존합니다.
  이후 마이페이지에서 원래 저장 키를 기준으로 사용자가 직접 제거할 수 있도록 검토합니다.
- 계정이 삭제되면 연결된 프로필과 북마크도 삭제됩니다.
- 콘텐츠 키 예시는 `course:institution:42`, `video:institution:42`, `video:youtube:MB-C001`입니다.
  외부 영상에는 현재 목록의 `id` 필드를 사용합니다. 키 검사 제약은 형식을 검증합니다.
  공급처의 ID 재부여나 실제 콘텐츠의 존재 여부는 별도의 데이터 갱신 정책이 필요합니다.
