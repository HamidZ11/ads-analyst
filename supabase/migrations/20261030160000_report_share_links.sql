-- Ad Analyst: read-only share links for a client report (D-094, D-NEW-share-1).
--
-- A link shows one client's report for one period to anyone holding it, with
-- no sign-in. The app makes a 256-bit random token and hands it to the owner
-- once; only its SHA-256 is stored, so the table never holds a usable link.
-- Links expire (30 days unless the owner picks otherwise) and can be revoked.
--
-- The anonymous read path is one security definer function,
-- shared_client_report, which takes the raw token, hashes it, checks expiry
-- and revocation, and returns only that client's rows for that period and
-- the one before it (what the report reads) plus the period's note. anon gets
-- execute on that function and nothing else: no table, no other function.
-- Members read their links through RLS (without the hash) and write only
-- through the definer functions below, as everywhere else (D-053).

-- ---------------------------------------------------------------------------
-- Links
-- ---------------------------------------------------------------------------

create table public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  -- The report's preset decides the comparison wording ("yesterday" or
  -- "the day before" for a one-day period), so it is kept with the dates.
  preset text not null check (preset in ('today', 'yesterday', '7d', '14d', '30d')),
  period_start date not null,
  period_end date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- Same composite key as every data table: a link can never point at
  -- another workspace's client, and goes with its client.
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  constraint report_share_links_period check (
    period_end - period_start + 1 = case preset when '7d' then 7 when '14d' then 14 when '30d' then 30 else 1 end),
  constraint report_share_links_expiry check (
    expires_at > created_at and expires_at <= created_at + interval '365 days')
);
create index report_share_links_workspace_idx on public.report_share_links (workspace_id, client_id);

alter table public.report_share_links enable row level security;

create policy report_share_links_member_read on public.report_share_links
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- Members may list their workspace's links, but not even they can read the
-- hash: every column except token_hash.
revoke all on public.report_share_links from public, anon, authenticated;
grant select (id, workspace_id, client_id, preset, period_start, period_end, created_by,
  created_at, expires_at, revoked_at) on public.report_share_links to authenticated;

-- ---------------------------------------------------------------------------
-- Lookup rate limit
-- ---------------------------------------------------------------------------

-- A fixed-window counter per visitor, like public.rate_limits (which is keyed
-- by a signed-in user and so cannot count anonymous visitors). The visitor is
-- whatever the app server identifies the request by (its client address);
-- only a SHA-256 of it is kept, and rows older than a day are dropped as new
-- lookups arrive. Nobody reads or writes it directly.
create table public.share_link_lookups (
  visitor_hash bytea primary key check (octet_length(visitor_hash) = 32),
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 0)
);
create index share_link_lookups_window_idx on public.share_link_lookups (window_started_at);
alter table public.share_link_lookups enable row level security;
revoke all on public.share_link_lookups from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner and member functions
-- ---------------------------------------------------------------------------

-- Creates a link for one client and period. Owners only, since a link takes
-- the client's figures outside the workspace. p_token is the raw token the
-- app generated (32 random bytes, base64url); it is hashed here and never
-- stored. Returns the link's id and expiry, or null when the client is not
-- in a workspace the caller owns.
create function public.create_report_share_link(
  p_client_id uuid,
  p_token text,
  p_preset text,
  p_period_start date,
  p_period_end date,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_link public.report_share_links;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_days is null or p_days not between 1 and 365
     or p_preset is null or p_period_start is null or p_period_end is null then
    raise exception 'invalid share link' using errcode = '22023';
  end if;
  select c.workspace_id into v_workspace from public.clients c
  where c.id = p_client_id
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = c.workspace_id and m.user_id = auth.uid() and m.role = 'owner');
  if v_workspace is null then
    return null;
  end if;
  insert into public.report_share_links
    (workspace_id, client_id, token_hash, preset, period_start, period_end, created_by, expires_at)
  values
    (v_workspace, p_client_id, pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')),
     p_preset, p_period_start, p_period_end, auth.uid(), now() + make_interval(days => p_days))
  returning * into v_link;
  return jsonb_build_object('id', v_link.id, 'expires_at', v_link.expires_at);
end;
$$;

-- Revokes a link at once. Any member of its workspace may, so whoever spots a
-- link that should not be out can close it. True when the link is the
-- caller's workspace's (already revoked or expired included), false otherwise.
create function public.revoke_report_share_link(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.report_share_links l
     set revoked_at = coalesce(l.revoked_at, now())
   where l.id = p_link_id and public.is_workspace_member(l.workspace_id)
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- The anonymous read path
-- ---------------------------------------------------------------------------

-- Everything one shared report shows, for the holder of its token:
--   {status: 'rate_limited'} the visitor's allowance is spent (60 lookups in
--                           10 minutes); nothing is looked up
--   {status: 'not_found'}   no such link (or not a token at all)
--   {status: 'expired'}     revoked, or past its expiry
--   {status: 'ok', ...}     the workspace's name, the client, the period, and
--                           only the rows the report reads: daily metrics from
--                           the start of the previous period to the end of
--                           this one, the entities those rows belong to, and
--                           the note for exactly this period.
-- Each call counts against the visitor's allowance before anything is read.
create function public.shared_client_report(p_token text, p_visitor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := 60;
  v_window constant interval := interval '10 minutes';
  v_hits integer;
  v_link public.report_share_links;
  v_since date;
  v_ads uuid[];
begin
  -- Old windows are dropped as new lookups arrive, so the table stays small.
  delete from public.share_link_lookups s where s.window_started_at < now() - interval '1 day';
  insert into public.share_link_lookups as s (visitor_hash, window_started_at, hits)
  values (pg_catalog.sha256(pg_catalog.convert_to('share:' || coalesce(p_visitor, ''), 'UTF8')), now(), 1)
  on conflict (visitor_hash) do update
    set window_started_at = case when s.window_started_at <= now() - v_window then now() else s.window_started_at end,
        hits = case when s.window_started_at <= now() - v_window then 1 else least(s.hits, v_limit) + 1 end
  returning hits into v_hits;
  if v_hits > v_limit then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_link from public.report_share_links l
  where l.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  v_since := v_link.period_start - (v_link.period_end - v_link.period_start + 1);
  select coalesce(array_agg(distinct d.ad_id), '{}') into v_ads
  from public.daily_metrics d
  where d.client_id = v_link.client_id and d.date between v_since and v_link.period_end;

  return jsonb_build_object(
    'status', 'ok',
    'expires_at', v_link.expires_at,
    'preset', v_link.preset,
    'period_start', v_link.period_start,
    'period_end', v_link.period_end,
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name)
                  from public.workspaces w where w.id = v_link.workspace_id),
    'client', (select jsonb_build_object(
                 'id', c.id, 'workspace_id', c.workspace_id, 'name', c.name, 'type', c.type,
                 'currency', c.currency, 'timezone', c.timezone, 'target_cpa', c.target_cpa,
                 'target_roas', c.target_roas, 'revenue_tracked', c.revenue_tracked,
                 'primary_conversion_column', null)
               from public.clients c where c.id = v_link.client_id),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'client_id', a.client_id, 'external_id', null,
                                          'name', a.name, 'currency', a.currency) order by a.created_at)
      from public.ad_accounts a where a.client_id = v_link.client_id), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'client_id', x.client_id, 'ad_account_id', x.ad_account_id,
                                          'name', x.name, 'objective', x.objective, 'status', x.status)
                       order by x.created_at, x.id)
      from public.campaigns x
      where x.client_id = v_link.client_id
        and x.id in (select s.campaign_id from public.ad_sets s join public.ads a on a.ad_set_id = s.id where a.id = any (v_ads))), '[]'::jsonb),
    'ad_sets', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'campaign_id', x.campaign_id, 'name', x.name,
                                          'audience', x.audience, 'status', x.status) order by x.created_at, x.id)
      from public.ad_sets x
      where x.client_id = v_link.client_id
        and x.id in (select a.ad_set_id from public.ads a where a.id = any (v_ads))), '[]'::jsonb),
    'creatives', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'client_id', x.client_id, 'name', x.name, 'type', x.type)
                       order by x.created_at, x.id)
      from public.creatives x
      where x.client_id = v_link.client_id
        and x.id in (select a.creative_id from public.ads a where a.id = any (v_ads))), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'ad_set_id', x.ad_set_id, 'creative_id', x.creative_id,
                                          'name', x.name, 'status', x.status) order by x.created_at, x.id)
      from public.ads x where x.client_id = v_link.client_id and x.id = any (v_ads)), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('ad_id', d.ad_id, 'date', d.date, 'spend', d.spend, 'revenue', d.revenue,
                                          'conversions', d.conversions, 'impressions', d.impressions, 'clicks', d.clicks)
                       order by d.date, d.ad_id)
      from public.daily_metrics d
      where d.client_id = v_link.client_id and d.date between v_since and v_link.period_end), '[]'::jsonb),
    'note', (select n.body from public.client_report_notes n
             where n.client_id = v_link.client_id
               and n.period_start = v_link.period_start and n.period_end = v_link.period_end)
  );
end;
$$;

-- Supabase grants execute on new functions to anon and authenticated by
-- default; each grant is set explicitly.
revoke all on function public.create_report_share_link(uuid, text, text, date, date, integer) from public, anon, authenticated;
revoke all on function public.revoke_report_share_link(uuid) from public, anon, authenticated;
revoke all on function public.shared_client_report(text, text) from public, anon, authenticated;
grant execute on function public.create_report_share_link(uuid, text, text, date, date, integer) to authenticated;
grant execute on function public.revoke_report_share_link(uuid) to authenticated;
-- The share page calls with the publishable key and no session.
grant execute on function public.shared_client_report(text, text) to anon;
