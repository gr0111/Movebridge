export type AuthAction = "confirm" | "recovery" | "reset-complete" | "recovery-request";
export type AuthCallback = { action: AuthAction; tokenHash: string | null };
export const resetCompletedKey = "movebridge:password-reset-completed";

export function readAuthCallback(url: URL): AuthCallback | null {
  const action = url.searchParams.get("auth");
  if (
    action !== "confirm" &&
    action !== "recovery" &&
    action !== "reset-complete" &&
    action !== "recovery-request"
  )
    return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const tokenHash =
    action === "recovery" || action === "confirm" ? fragment.get("token_hash") : null;
  return { action, tokenHash };
}

export function authUrl(current: URL, action: AuthAction | null) {
  const url = new URL(current);
  for (const key of ["auth", "token_hash", "code", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  if (action) url.searchParams.set("auth", action);
  url.hash = "";
  return url;
}

export function authMessage(error: { code?: string }, fallback: string) {
  switch (error.code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "email_not_confirmed":
      return "메일함에서 이메일 확인을 완료한 뒤 로그인해 주세요.";
    case "weak_password":
      return "프로젝트의 비밀번호 요구사항을 충족하는 비밀번호를 입력해 주세요.";
    case "same_password":
      return "기존 비밀번호와 다른 비밀번호를 입력해 주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return fallback;
  }
}

export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 8) return "비밀번호는 8자 이상으로 입력해 주세요.";
  if (password !== confirmation) return "두 비밀번호가 일치하지 않습니다.";
  return "";
}
