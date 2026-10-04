-- Ad Analyst: per-user rate limits, and import records attributed to their
-- real author.

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------

-- One fixed-window counter per user and action. Nobody reads or writes it
-- directly; consume_rate_limit is the only way in.
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (user_id, action)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one attempt at p_action by the caller and returns whether it is
-- within the allowance for the current window. The allowance is set here,
-- never by the caller, and the key is auth.uid(), so a caller can only spend
-- their own. Security definer because callers have no access to rate_limits.
-- `hits` stops one past the limit, so repeated calls cannot grow it.
create function public.consume_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_window interval;
  v_hits integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  case p_action
    -- An import parses up to 10 MB of CSV on the app server, then writes up
    -- to 100,000 rows in one transaction.
    when 'import' then v_limit := 30; v_window := interval '1 hour';
    else raise exception 'unknown rate limit' using errcode = '22023';
  end case;
  insert into public.rate_limits as r (user_id, action, window_started_at, hits)
  values (v_user, p_action, now(), 1)
  on conflict (user_id, action) do update
    set window_started_at = case when r.window_started_at <= now() - v_window then now() else r.window_started_at end,
        hits = case when r.window_started_at <= now() - v_window then 1 else least(r.hits, v_limit) + 1 end
  returning hits into v_hits;
  return v_hits <= v_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Import records name the member who made them
-- ---------------------------------------------------------------------------

-- imported_by defaults to the caller; members could still insert a record
-- naming someone else. The audit trail now only accepts the caller.
drop policy imports_member_insert on public.imports;
create policy imports_member_insert on public.imports
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and imported_by = auth.uid());
