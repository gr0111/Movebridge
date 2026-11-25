begin;

set local search_path = public, extensions;
select plan(23);

-- Create fixtures as the test runner. The actual Auth HTTP signup is a separate smoke check.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');
select is(
  (select count(*) from public.profiles
   where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')
     and display_name is null and updated_at = created_at),
  2::bigint, 'both profiles are created with null names and initial timestamps'
);

-- Both users exercise the same database role with distinct PostgREST-style JWT claims.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$insert into public.bookmarks (user_id, content_key)
    values ('00000000-0000-4000-8000-00000000000b', 'course:institution:42')$$,
  'B can save a bookmark'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(auth.uid(), '00000000-0000-4000-8000-00000000000a'::uuid, 'RLS sees the JWT subject for A');
select lives_ok(
  $$insert into public.bookmarks (user_id, content_key)
    values ('00000000-0000-4000-8000-00000000000a', 'course:institution:42')$$,
  'A can save the same content as B in their own account'
);
select is(
  (select count(*) from public.bookmarks where content_key = 'course:institution:42'),
  1::bigint, 'A sees exactly their own copy of the bookmark'
);
select is(
  (select count(*) from public.bookmarks where user_id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'A cannot select B bookmarks'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, content_key)
    values ('00000000-0000-4000-8000-00000000000b', 'course:institution:43')$$,
  '42501', null, 'A cannot insert a bookmark owned by B'
);
with removed as (
  delete from public.bookmarks where user_id = '00000000-0000-4000-8000-00000000000b'
  returning id
)
select is(count(*), 0::bigint, 'A cannot delete any B bookmark') from removed;
select throws_ok(
  $$insert into public.bookmarks (user_id, content_key)
    values ('00000000-0000-4000-8000-00000000000a', 'course:institution:42')$$,
  '23505', null, 'A cannot duplicate their bookmark'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, content_key)
    values ('00000000-0000-4000-8000-00000000000a', '')$$,
  '23514', null, 'blank content keys fail the check constraint'
);
select lives_ok(
  $$insert into public.bookmarks (user_id, content_key) values
    ('00000000-0000-4000-8000-00000000000a', 'video:institution:42'),
    ('00000000-0000-4000-8000-00000000000a', 'video:youtube:MB-C001')$$,
  'institution and YouTube keys are distinct from course keys'
);
select throws_ok(
  $$update public.bookmarks set content_key = 'course:institution:43'
    where content_key = 'course:institution:42'$$,
  '42501', null, 'clients cannot update bookmarks'
);
with removed as (
  delete from public.bookmarks
  where user_id = '00000000-0000-4000-8000-00000000000a' and content_key = 'course:institution:42'
  returning id
)
select is(count(*), 1::bigint, 'A can delete their own course bookmark') from removed;
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a'),
  1::bigint, 'A can select their own profile'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'A cannot select B profile'
);
with updated as (
  update public.profiles set display_name = 'Not B'
  where id = '00000000-0000-4000-8000-00000000000b' returning id
)
select is(count(*), 0::bigint, 'A cannot update B profile') from updated;

with updated as (
  update public.profiles set display_name = 'Member A'
  where id = '00000000-0000-4000-8000-00000000000a'
  returning display_name, created_at, updated_at
)
select ok(
  coalesce(bool_and(display_name = 'Member A' and updated_at > created_at), false),
  'A can update their name and the trigger refreshes updated_at'
) from updated;
select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'clients cannot insert profiles'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select count(*) from public.bookmarks where content_key = 'course:institution:42'),
  1::bigint, 'B still sees their bookmark after both delete attempts by A'
);

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select throws_ok('select * from public.bookmarks', '42501', null, 'anon cannot read bookmarks');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');

-- Privileged fixture cleanup verifies the database foreign keys, separately from RLS.
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'deleting B cascades to their profile'
);
select is(
  (select count(*) from public.bookmarks where user_id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'deleting B cascades to their bookmarks'
);

select * from finish();
rollback;
