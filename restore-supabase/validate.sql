\pset pager off
\echo === public tables ===
select schemaname, tablename
from pg_tables
where schemaname = 'public'
order by tablename;

create or replace function pg_temp.safe_count(target text)
returns text
language plpgsql
as $$
declare
  relation regclass;
  row_count bigint;
begin
  relation := to_regclass(target);
  if relation is null then
    return 'missing';
  end if;

  execute format('select count(*) from %s', relation) into row_count;
  return row_count::text;
end;
$$;

create or replace function pg_temp.safe_settings_keys()
returns table(setting_key text)
language plpgsql
as $$
begin
  if to_regclass('public.settings') is null then
    return;
  end if;

  return query execute 'select key::text from public.settings order by key';
end;
$$;

create or replace function pg_temp.safe_auth_users()
returns table(user_email text)
language plpgsql
as $$
begin
  if to_regclass('auth.users') is null then
    return;
  end if;

  return query execute 'select email::text from auth.users order by created_at desc nulls last';
end;
$$;

\echo === table presence and row counts ===
with targets(table_name) as (
  values
    ('public.projects'),
    ('public.skills'),
    ('public.settings'),
    ('public.project_images'),
    ('public.contact_messages'),
    ('public.admin_activity'),
    ('storage.buckets'),
    ('storage.objects'),
    ('auth.users')
)
select
  table_name,
  to_regclass(table_name) is not null as exists,
  pg_temp.safe_count(table_name) as row_count
from targets
order by table_name;

\echo === storage buckets ===
select id, name, public
from storage.buckets
order by id;

\echo === settings keys ===
select setting_key
from pg_temp.safe_settings_keys();

\echo === auth users ===
select user_email
from pg_temp.safe_auth_users();
