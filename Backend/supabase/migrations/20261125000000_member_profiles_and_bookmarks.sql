create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_key text not null,
  created_at timestamptz not null default now(),
  constraint bookmarks_user_content_unique unique (user_id, content_key),
  constraint bookmarks_content_key_format check (
    content_key ~ '^(course:institution:[0-9]+|video:institution:[0-9]+|video:youtube:MB-C[0-9]+)$'
  )
);

create function public.create_member_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function public.create_member_profile() from public, anon, authenticated;

create trigger movebridge_auth_user_inserted
after insert on auth.users
for each row execute function public.create_member_profile();

create function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

create trigger movebridge_profile_updated
before update on public.profiles
for each row execute function public.set_profile_updated_at();

alter table public.profiles enable row level security;
alter table public.bookmarks enable row level security;

revoke all on public.profiles, public.bookmarks from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert (user_id, content_key) on public.bookmarks to authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy bookmarks_select_own on public.bookmarks
for select to authenticated using ((select auth.uid()) = user_id);

create policy bookmarks_insert_own on public.bookmarks
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy bookmarks_delete_own on public.bookmarks
for delete to authenticated using ((select auth.uid()) = user_id);
