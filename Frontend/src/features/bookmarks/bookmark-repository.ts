import type { SupabaseClient } from "@supabase/supabase-js";
import { courseContentKey, courseKeyPrefix } from "./content-key.ts";

export type CourseBookmarkRepository = {
  list: (signal: AbortSignal) => Promise<string[]>;
  save: (id: number, signal: AbortSignal) => Promise<void>;
  remove: (id: number, signal: AbortSignal) => Promise<void>;
};

const pageSize = 500;

function requireCourseKey(id: number) {
  const key = courseContentKey(id);
  if (!key) throw new Error("Invalid course ID");
  return key;
}

export function courseBookmarkRepository(
  client: SupabaseClient,
  userId: string,
): CourseBookmarkRepository {
  const table = () => client.from("bookmarks");
  const matchingRow = (key: string) =>
    table().select("content_key").eq("user_id", userId).eq("content_key", key);

  return {
    async list(signal) {
      const keys: string[] = [];
      let cursor: string | undefined;
      while (true) {
        const query = table()
          .select("content_key")
          .eq("user_id", userId)
          .like("content_key", `${courseKeyPrefix}%`)
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
    async save(id, signal) {
      const key = requireCourseKey(id);
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
    async remove(id, signal) {
      const key = requireCourseKey(id);
      const { error } = await table()
        .delete()
        .eq("user_id", userId)
        .eq("content_key", key)
        .abortSignal(signal);
      if (error) throw error;
    },
  };
}
