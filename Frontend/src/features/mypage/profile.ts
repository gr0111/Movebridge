import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = { display_name: string | null; created_at: string };
const profileColumns = "display_name, created_at";
const memberDate = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

export const defaultDisplayName = "무브릿 회원";

export function validateDisplayName(input: string) {
  const name = input.trim().normalize("NFC");
  if (!name) return { name: null, error: "" };
  const length = Array.from(name).length;
  if (length < 2 || length > 24) return { name: null, error: "닉네임은 2~24자로 입력해 주세요." };
  if (!/^[\p{L}\p{M}\p{N} _-]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    return { name: null, error: "닉네임은 글자, 숫자, 공백, 하이픈, 밑줄을 사용할 수 있어요." };
  }
  return { name, error: "" };
}

export function joinedOn(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "확인할 수 없음" : memberDate.format(date);
}

export function profileRepository(client: SupabaseClient, userId: string) {
  return {
    async load(signal: AbortSignal): Promise<Profile> {
      const { data, error } = await client
        .from("profiles")
        .select(profileColumns)
        .eq("id", userId)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data;
    },
    async save(displayName: string | null, signal: AbortSignal): Promise<Profile> {
      const { data, error } = await client
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId)
        .select(profileColumns)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data;
    },
  };
}
