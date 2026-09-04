#!/bin/sh
set -eu

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_user="$POSTGRES_APP_USER" \
  --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
select format('create role %I login password %L', :'app_user', :'app_password')
where not exists (select 1 from pg_roles where rolname = :'app_user') \gexec

select format('grant connect on database %I to %I', current_database(), :'app_user') \gexec
select format('grant usage on schema public to %I', :'app_user') \gexec
select format('grant select, insert, update, delete on all tables in schema public to %I', :'app_user') \gexec
select format('grant usage, select on all sequences in schema public to %I', :'app_user') \gexec
select format('alter default privileges in schema public grant select, insert, update, delete on tables to %I', :'app_user') \gexec
select format('alter default privileges in schema public grant usage, select on sequences to %I', :'app_user') \gexec
SQL
