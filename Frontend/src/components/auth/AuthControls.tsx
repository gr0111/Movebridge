import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authMessage, authUrl, passwordProblem, resetCompletedKey } from "../../auth/auth-flow";
import { useAuth } from "../../auth/AuthProvider";
import Icon from "../Icon";
import "./auth.css";

type Screen =
  | "login"
  | "signup"
  | "recovery-request"
  | "password"
  | "account"
  | "confirm"
  | "recovery"
  | "confirmed"
  | "invalid";

const titles: Record<Screen, string> = {
  login: "로그인",
  signup: "회원가입",
  "recovery-request": "비밀번호 찾기",
  password: "새 비밀번호 설정",
  account: "내 계정",
  confirm: "이메일 확인",
  recovery: "비밀번호 재설정 링크 확인",
  confirmed: "이메일 확인 완료",
  invalid: "인증 링크를 사용할 수 없어요",
};

const signupNotice =
  "가입을 진행할 수 있는 주소라면 확인 메일이 도착합니다. 메일의 링크를 열어 이메일을 확인해 주세요.";
const recoverySent = "입력한 주소로 재설정할 수 있는 계정이 있다면 메일이 도착합니다.";

function PasswordField({
  name,
  label,
  newPassword,
}: {
  name: string;
  label: string;
  newPassword: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <div className="auth-password">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          minLength={newPassword ? 8 : undefined}
          required
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={`${label} ${visible ? "숨기기" : "표시"}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "숨기기" : "표시"}
        </button>
      </div>
    </div>
  );
}

function AuthDialog({
  title,
  close,
  busy,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <dialog
      className="detail-modal auth-dialog"
      aria-labelledby="auth-dialog-title"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <button
        type="button"
        className="modal-close icon-button"
        onClick={close}
        disabled={busy}
        aria-label="인증 창 닫기"
      >
        <Icon name="close" />
      </button>
      <h2 id="auth-dialog-title" tabIndex={-1} ref={heading}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

export default function AuthControls({ request, onMyPage }: { request: number; onMyPage: () => void }) {
  const { client, session, pending, error: startupError, callback } = useAuth();
  const recovery = callback?.action === "recovery";
  const [open, setOpen] = useState(Boolean(callback));
  const [requestedScreen, setScreen] = useState<Screen>(() => {
    if (callback?.action === "confirm" || callback?.action === "recovery") {
      return callback.tokenHash ? callback.action : "invalid";
    }
    return callback?.action === "recovery-request" ? "recovery-request" : "login";
  });
  const [notice, setNotice] = useState(
    callback?.action === "reset-complete"
      ? "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요."
      : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const previousRequest = useRef(request);
  const screen = requestedScreen === "account" && !session ? "login" : requestedScreen;

  useEffect(() => {
    if (previousRequest.current === request) return;
    previousRequest.current = request;
    setScreen(session ? "account" : "login");
    setError("");
    setNotice("");
    setOpen(true);
  }, [request, session]);

  function switchTo(next: Screen, message = "") {
    setScreen(next);
    setError("");
    setNotice(message);
  }

  function openLogin() {
    switchTo("login");
    setOpen(true);
  }

  const leaveRecovery = (action: "reset-complete" | "recovery-request" | null) =>
    window.location.replace(authUrl(new URL(window.location.href), action));

  function close() {
    if (submitting.current) return;
    if (recovery) {
      leaveRecovery(null);
    } else {
      setOpen(false);
    }
  }

  async function run(action: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch {
      setError("인증 요청을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  function verifyLink() {
    if (!client || !callback?.tokenHash) return;
    void run(async () => {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: callback.tokenHash!,
        type: recovery ? "recovery" : "email",
      });
      if (error || !data.session) {
        if (error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500)) {
          setError("인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        } else {
          switchTo("invalid");
        }
        return;
      }
      switchTo(recovery ? "password" : "confirmed");
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("auth-email") ?? "").trim();
    const password = String(form.get("auth-password") ?? "");
    if (screen === "signup" || screen === "password") {
      const problem = passwordProblem(password, String(form.get("auth-password-confirm") ?? ""));
      if (problem) {
        setError(problem);
        return;
      }
    }

    void run(async () => {
      const auth = client.auth;
      const url = new URL(window.location.href);
      if (screen === "login") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error)
          setError(authMessage(error, "로그인할 수 없습니다. 잠시 후 다시 시도해 주세요."));
        else setOpen(false);
      } else if (screen === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authUrl(url, "confirm").href },
        });
        if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
          setError(
            authMessage(error, "가입 요청을 완료할 수 없습니다. 잠시 후 다시 시도해 주세요."),
          );
        } else if (data.session) {
          switchTo("account", "가입이 완료되어 로그인했습니다.");
        } else {
          switchTo("login", signupNotice);
        }
      } else if (screen === "recovery-request") {
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: authUrl(url, "recovery").href,
        });
        if (error && error.code !== "user_not_found") {
          setError(
            authMessage(error, "재설정 요청을 완료할 수 없습니다. 잠시 후 다시 시도해 주세요."),
          );
        } else {
          switchTo("login", recoverySent);
        }
      } else if (screen === "password") {
        const { error } = await auth.updateUser({ password });
        if (error) {
          if (
            ["session_not_found", "refresh_token_not_found", "bad_jwt"].includes(error.code ?? "")
          ) {
            switchTo("invalid");
          } else {
            setError(
              authMessage(
                error,
                "비밀번호 변경을 완료할 수 없습니다. 새 링크를 요청하거나 다시 시도해 주세요.",
              ),
            );
          }
        } else {
          await auth.signOut({ scope: "global" }).catch(() => undefined);
          try {
            sessionStorage.setItem(resetCompletedKey, "true");
            leaveRecovery("reset-complete");
          } catch {
            leaveRecovery(null);
          }
        }
      }
    });
  }

  function signOut() {
    if (!client) return;
    void run(async () => {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      else setOpen(false);
    });
  }

  const isForm = ["login", "signup", "recovery-request", "password"].includes(screen);
  const needsEmail = screen !== "password";
  const needsPassword = screen !== "recovery-request";
  const newPassword = screen === "signup" || screen === "password";
  return (
    <>
      <button
        type="button"
        className={`secondary-button auth-entry${session ? " auth-entry-member" : ""}`}
        onClick={session ? onMyPage : openLogin}
        disabled={pending}
      >
        {session && <Icon name="user" size={16} />}
        {pending ? "확인 중…" : session ? "마이페이지" : "로그인"}
      </button>
      {open && (
        <AuthDialog title={titles[screen]} close={close} busy={busy}>
          <div className="auth-content" aria-busy={pending || busy}>
            {startupError && (
              <p className="auth-message auth-error" role="alert">
                {startupError}
              </p>
            )}
            {error && (
              <p className="auth-message auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-message" role="status">
                {notice}
              </p>
            )}
            {pending && <p role="status">인증 상태를 확인하고 있습니다.</p>}
            {!pending && client && (
              <>
                {isForm && (
                  <form key={screen} onSubmit={submit} className="auth-form">
                    <fieldset disabled={busy}>
                      {needsEmail && (
                        <label className="auth-field">
                          이메일
                          <input name="auth-email" type="email" autoComplete="email" required />
                        </label>
                      )}
                      {needsPassword && (
                        <PasswordField
                          name="auth-password"
                          label={screen === "password" ? "새 비밀번호" : "비밀번호"}
                          newPassword={newPassword}
                        />
                      )}
                      {newPassword && (
                        <PasswordField
                          name="auth-password-confirm"
                          label="비밀번호 확인"
                          newPassword
                        />
                      )}
                      <button className="primary-button" type="submit">
                        {busy
                          ? "처리 중…"
                          : screen === "recovery-request"
                            ? "재설정 메일 보내기"
                            : titles[screen]}
                      </button>
                    </fieldset>
                    <div className="auth-switch">
                      {screen === "login" && (
                        <>
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy}
                            onClick={() => switchTo("signup")}
                          >
                            회원가입
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy}
                            onClick={() => switchTo("recovery-request")}
                          >
                            비밀번호 찾기
                          </button>
                        </>
                      )}
                      {(screen === "signup" || screen === "recovery-request") && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={() => switchTo("login")}
                        >
                          로그인으로 돌아가기
                        </button>
                      )}
                    </div>
                  </form>
                )}
                {screen === "account" && session && (
                  <>
                    <p>{session.user.email}</p>
                    <p className="auth-note">
                      로그인한 상태에서 담은 강좌는 이 계정에 저장됩니다.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={signOut}
                    >
                      {busy ? "로그아웃 중…" : "로그아웃"}
                    </button>
                  </>
                )}
                {(screen === "confirm" || screen === "recovery") && (
                  <>
                    <p>아래 버튼을 눌러 이메일로 받은 인증 링크를 확인해 주세요.</p>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy}
                      onClick={verifyLink}
                    >
                      {busy ? "확인 중…" : titles[screen]}
                    </button>
                  </>
                )}
                {screen === "confirmed" && (
                  <>
                    <p>이메일이 확인되어 로그인했습니다.</p>
                    <button type="button" className="primary-button" onClick={close}>
                      운동 찾기 계속하기
                    </button>
                  </>
                )}
                {screen === "invalid" && (
                  <>
                    <p role="alert">
                      링크가 만료되었거나 이미 사용되었습니다. 새 링크를 요청해 주세요.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        recovery ? leaveRecovery("recovery-request") : switchTo("login")
                      }
                    >
                      {recovery ? "새 재설정 링크 요청" : "로그인으로 돌아가기"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </AuthDialog>
      )}
    </>
  );
}
