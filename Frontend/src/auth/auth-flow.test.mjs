import test from "node:test";
import assert from "node:assert/strict";
import {
  authMessage,
  authUrl,
  passwordProblem,
  readAuthCallback,
  savedForAccount,
} from "./auth-flow.ts";

test("signup and recovery callbacks accept a fragment token for their explicit flow", () => {
  assert.deepEqual(
    readAuthCallback(new URL("https://example.com/?auth=recovery#token_hash=test-token")),
    { action: "recovery", tokenHash: "test-token" },
  );
  assert.deepEqual(
    readAuthCallback(new URL("https://example.com/?auth=confirm#token_hash=test-token")),
    { action: "confirm", tokenHash: "test-token" },
  );
  assert.deepEqual(readAuthCallback(new URL("https://example.com/?auth=recovery")), {
    action: "recovery",
    tokenHash: null,
  });
  assert.deepEqual(
    readAuthCallback(new URL("https://example.com/?auth=recovery&token_hash=ignored")),
    { action: "recovery", tokenHash: null },
  );
  assert.equal(
    readAuthCallback(new URL("https://example.com/?auth=unknown#token_hash=ignored")),
    null,
  );
});

test("callback cleanup keeps the origin and harmless query but removes credentials", () => {
  const url = new URL(
    "https://example.com/?ref=example&auth=recovery&code=discard#token_hash=discard",
  );
  assert.equal(authUrl(url, "recovery").href, "https://example.com/?ref=example&auth=recovery");
  assert.equal(authUrl(url, null).href, "https://example.com/?ref=example");
  assert.equal(
    authUrl(url, "reset-complete").href,
    "https://example.com/?ref=example&auth=reset-complete",
  );
});

test("signup and reset validate password confirmation without modifying passwords", () => {
  assert.ok(passwordProblem("short", "short"));
  assert.ok(passwordProblem("password1", "password2"));
  assert.equal(passwordProblem(" password ", " password "), "");
});

test("auth errors use safe copy and login distinguishes unconfirmed email", () => {
  assert.match(authMessage({ code: "email_not_confirmed" }, ""), /이메일 확인/);
  assert.match(authMessage({ code: "invalid_credentials" }, ""), /이메일 또는 비밀번호/);
  assert.equal(authMessage({ code: "unknown" }, "retry"), "retry");
});

test("switching between accounts or to guest clears memory bookmarks", () => {
  const previous = { owner: "member-a", ids: [1, 2] };
  assert.equal(savedForAccount(previous, "member-a"), previous);
  assert.deepEqual(savedForAccount(previous, "member-b"), { owner: "member-b", ids: [] });
  assert.deepEqual(savedForAccount(previous, null), { owner: null, ids: [] });
  assert.deepEqual(savedForAccount({ owner: null, ids: [5] }, "member-a"), {
    owner: "member-a",
    ids: [],
  });
});
