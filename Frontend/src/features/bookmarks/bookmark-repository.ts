import type { SupabaseClient } from "@supabase/supabase-js";
import { bookmarkKind, courseContentKey, isVideoContentKey } from "./content-key.ts";

export type BookmarkTarget = number | string;

export type CourseBookmarkRepository = {
  list: (signal: AbortSignal) => Promise<string[]>;
  save: (target: BookmarkTarget, signal: AbortSignal) => Promise<void>;
  remove: (target: BookmarkTarget, signal: AbortSignal) => Promise<void>;
  removeUnavailable: (key: string, signal: AbortSignal) => Promise<void>;
};

const pageSize = 500;

function requireContentKey(target: BookmarkTarget) {
  const key =
    typeof target === "number"
      ? courseContentKey(target)
      : isVideoContentKey(target)
        ? target
        : null;
  if (!key) throw new Error("Invalid bookmark target");
  return key;
}

export function courseBookmarkRepository(
  client: SupabaseClient,
  userId: string,
): CourseBookmarkRepository {
  const table = () => client.from("bookmarks");
  const matchingRow = (key: string) =>
    table().select("content_key").eq("user_id", userId).eq("content_key", key);
  async function removeKey(key: string, signal: AbortSignal) {
    const { error } = await table()
      .delete()
      .eq("user_id", userId)
      .eq("content_key", key)
      .abortSignal(signal);
    if (error) throw error;
  }

  return {
    async list(signal) {
      const keys: string[] = [];
      let cursor: string | undefined;
      while (true) {
        const query = table()
          .select("content_key")
          .eq("user_id", userId)
          .order("content_key")
          .limit(pageSize);
        if (cursor) query.gt("content_key", cursor);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw error;
        if (!data.length) return keys;
        keys.push(...data.map((row) => row.content_key as string));
        cursor = keys[keys.length - 1];
      }
    },
    async save(target, signal) {
      const key = requireContentKey(target);
      const { error } = await table()
        .insert({ user_id: userId, content_key: key })
        .abortSignal(signal);
      if (!error) return;
      if (error.code === "23505") {
        const existing = await matchingRow(key).abortSignal(signal).maybeSingle();
        if (!existing.error && existing.data) return;
      }
      throw error;
    },
    async remove(target, signal) {
      await removeKey(requireContentKey(target), signal);
    },
    async removeUnavailable(key, signal) {
      if (!bookmarkKind(key)) throw new Error("Invalid bookmark key");
      await removeKey(key, signal);
    },
  };
}
