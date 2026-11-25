begin;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok($$insert into public.workout_plans (id,user_id,title,day_of_week,start_time,end_time)
  values ('bbb00000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000b','B walk',0,'19:00','20:00')$$,
  'B creates a plan');
select lives_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000b','bbb00000-0000-4000-8000-000000000001','2026-11-23')$$,
  'B completes their Monday plan');

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(auth.uid(), '00000000-0000-4000-8000-00000000000a'::uuid, 'JWT identifies A');
select lives_ok($$insert into public.workout_plans (id,user_id,title,day_of_week,start_time,end_time)
  values ('aaa00000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000a','A home routine',0,'19:00','19:40'),
         ('aaa00000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000000a','A run',0,'19:00','19:40')$$,
  'A creates two overlapping plans');
select is((select count(*) from public.workout_plans), 2::bigint, 'A only sees both own plans');
select throws_ok($$insert into public.workout_plans (user_id,title,day_of_week,start_time,end_time)
  values ('00000000-0000-4000-8000-00000000000b','Spoof owner',0,'19:00','19:40')$$,
  '42501', null, 'A cannot create plans in B account');
select throws_ok($$update public.workout_plans set title = E' \t\n'$$,
  '23514', null, 'blank workout titles fail');
select throws_ok($$update public.workout_plans set title = repeat('운',81)$$,
  '23514', null, 'overlong titles fail');
select throws_ok($$update public.workout_plans set day_of_week = 7$$,
  '23514', null, 'days must be Monday to Sunday');
select throws_ok($$update public.workout_plans set start_time = '23:00', end_time = '01:00'$$,
  '23514', null, 'plans cannot cross midnight');
select throws_ok($$update public.workout_plans set end_time = '24:00'$$,
  '23514', null, '24:00 is excluded');
select throws_ok($$update public.workout_plans set end_time = '19:00'$$,
  '23514', null, 'zero duration is excluded');
select throws_ok($$update public.workout_plans set note = repeat('x',501)$$,
  '23514', null, 'notes are limited to 500 characters');
with changed as (update public.workout_plans set note = 'short', end_time = '19:35'
  where id = 'aaa00000-0000-4000-8000-000000000001' returning note, updated_at, created_at)
select ok(coalesce(bool_and(note = 'short' and updated_at > created_at), false), 'A updates own plan and timestamp') from changed;
with changed as (update public.workout_plans set title = 'Changed by A'
  where id = 'bbb00000-0000-4000-8000-000000000001' returning id)
select is(count(*), 0::bigint, 'A cannot update B plan') from changed;
with removed as (delete from public.workout_plans where id = 'bbb00000-0000-4000-8000-000000000001' returning id)
select is(count(*), 0::bigint, 'A cannot delete B plan') from removed;
select is((select count(*) from public.workout_completions), 0::bigint, 'A cannot view B completion');
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000a','bbb00000-0000-4000-8000-000000000001','2026-11-30')$$,
  '42501', null, 'RLS rejects an A completion attached to B plan');
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000a','bbb00000-0000-4000-8000-000000000001','2026-11-23')$$,
  '42501', null, 'RLS rejects the same request even when B already marked that date complete');
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000b','bbb00000-0000-4000-8000-000000000001','2026-11-30')$$,
  '42501', null, 'RLS rejects A writing with B user ID');
with removed as (delete from public.workout_completions where plan_id = 'bbb00000-0000-4000-8000-000000000001' returning id)
select is(count(*), 0::bigint, 'A cannot delete B completion') from removed;
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000a','aaa00000-0000-4000-8000-000000000001','2026-11-24')$$,
  '23514', null, 'Monday workout cannot be completed on Tuesday');
select lives_ok($$insert into public.workout_completions (user_id,plan_id,performed_on) values
  ('00000000-0000-4000-8000-00000000000a','aaa00000-0000-4000-8000-000000000001','2026-11-23'),
  ('00000000-0000-4000-8000-00000000000a','aaa00000-0000-4000-8000-000000000001','2026-11-30'),
  ('00000000-0000-4000-8000-00000000000a','aaa00000-0000-4000-8000-000000000002','2026-11-30')$$,
  'A can complete their plans on multiple independent weeks');
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000a','aaa00000-0000-4000-8000-000000000001','2026-11-23')$$,
  '23505', null, 'same plan and date cannot be recorded twice');
select throws_ok($$update public.workout_completions set performed_on = '2026-12-07'$$,
  '42501', null, 'completion updates are denied');
with removed as (delete from public.workout_completions where plan_id = 'aaa00000-0000-4000-8000-000000000001'
  and performed_on = '2026-11-23' returning id)
select is(count(*), 1::bigint, 'A can cancel one date') from removed;
select is((select count(*) from public.workout_completions where performed_on = '2026-11-30'),
  2::bigint, 'cancellation leaves other dates and plans');
select lives_ok($$update public.workout_plans set day_of_week = 6 where id = 'aaa00000-0000-4000-8000-000000000001'$$,
  'weekday can change after existing completions');
select is((select min(performed_on) from public.workout_completions where plan_id = 'aaa00000-0000-4000-8000-000000000001'),
  '2026-11-30'::date, 'weekday change preserves historical records');
select lives_ok($$delete from public.workout_plans where id = 'aaa00000-0000-4000-8000-000000000001'$$,
  'A can delete own plan');
select is((select count(*) from public.workout_completions), 1::bigint, 'plan deletion cascades to that plan records only');

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select throws_ok('select id from public.workout_plans', '42501', null, 'guests cannot read personal plans');
select throws_ok('select id from public.workout_completions', '42501', null, 'guests cannot read completion records');

reset role;
select throws_ok($$insert into public.workout_completions (user_id,plan_id,performed_on)
  values ('00000000-0000-4000-8000-00000000000a','bbb00000-0000-4000-8000-000000000001','2026-11-30')$$,
  '23503', null, 'the composite foreign key enforces ownership independently of RLS');
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select is((select count(*) from public.workout_plans where id in (
  'aaa00000-0000-4000-8000-000000000002', 'bbb00000-0000-4000-8000-000000000001')),
  1::bigint, 'account deletion cascades only to its plans');
select is((select count(*) from public.workout_completions where plan_id in (
  'aaa00000-0000-4000-8000-000000000002', 'bbb00000-0000-4000-8000-000000000001')),
  1::bigint, 'account deletion cascades only to its completion records');
select * from finish();
rollback;
