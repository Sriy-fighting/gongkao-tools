-- Edge Function uses the service role to count requests. Users cannot read or write this table directly.
create table if not exists public.ai_plan_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_plan_requests_user_created_at_idx
  on public.ai_plan_requests (user_id, created_at desc);

alter table public.ai_plan_requests enable row level security;

-- The Edge Function calls this as service_role. An advisory transaction lock makes
-- the count and insert atomic for a single user, so concurrent browser requests
-- cannot bypass the hourly allowance.
create or replace function public.consume_ai_plan_quota(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_count integer;
begin
  if target_user is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_user::text, 0));
  select count(*) into request_count
  from public.ai_plan_requests
  where user_id = target_user
    and created_at >= now() - interval '1 hour';

  if request_count >= 5 then
    return false;
  end if;

  insert into public.ai_plan_requests (user_id) values (target_user);
  return true;
end;
$$;

revoke all on function public.consume_ai_plan_quota(uuid) from public;
grant execute on function public.consume_ai_plan_quota(uuid) to service_role;
