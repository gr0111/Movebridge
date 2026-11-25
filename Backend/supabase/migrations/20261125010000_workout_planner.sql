create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]' and char_length(title) <= 80),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (start_time < end_time and end_time < time '24:00'
    and extract(second from start_time) = 0 and extract(second from end_time) = 0)
);

create table public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null,
  performed_on date not null,
  completed_at timestamptz not null default now(),
  unique (plan_id, performed_on),
  foreign key (plan_id, user_id) references public.workout_plans (id, user_id) on delete cascade
);

comment on column public.workout_plans.day_of_week is 'Korea time: Monday = 0, Sunday = 6.';
create index workout_plans_user_id_idx on public.workout_plans (user_id, id);
create index workout_completions_user_id_idx on public.workout_completions (user_id, id);

create function public.set_workout_plan_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function public.check_workout_completion_weekday()
returns trigger language plpgsql set search_path = '' as $$
declare
  plan_weekday smallint;
begin
  -- Synchronize an insert with a concurrent weekday edit. The composite FK checks ownership.
  select day_of_week into plan_weekday from public.workout_plans
    where id = new.plan_id and user_id = new.user_id for share;
  if found and extract(isodow from new.performed_on) - 1 is distinct from plan_weekday then
    raise exception 'Completion date must match the workout plan weekday' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.set_workout_plan_updated_at() from public, anon, authenticated;
revoke all on function public.check_workout_completion_weekday() from public, anon, authenticated;

create trigger workout_plan_updated_at before update on public.workout_plans
for each row execute function public.set_workout_plan_updated_at();

create trigger workout_completion_weekday before insert on public.workout_completions
for each row execute function public.check_workout_completion_weekday();

alter table public.workout_plans enable row level security;
alter table public.workout_completions enable row level security;

revoke all on public.workout_plans, public.workout_completions from public, anon, authenticated;
grant select, delete on public.workout_plans, public.workout_completions to authenticated;
grant insert (id, user_id, title, day_of_week, start_time, end_time, note) on public.workout_plans to authenticated;
grant update (title, day_of_week, start_time, end_time, note) on public.workout_plans to authenticated;
grant insert (user_id, plan_id, performed_on) on public.workout_completions to authenticated;

create policy workout_plans_select_own on public.workout_plans
for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_plans_insert_own on public.workout_plans
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_plans_update_own on public.workout_plans
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy workout_plans_delete_own on public.workout_plans
for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_completions_select_own on public.workout_completions
for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_completions_insert_own on public.workout_completions
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.workout_plans as plan
    where plan.id = workout_completions.plan_id and plan.user_id = workout_completions.user_id
  )
);
create policy workout_completions_delete_own on public.workout_completions
for delete to authenticated using ((select auth.uid()) = user_id);
