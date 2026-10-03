-- Ad Analyst: workspaces, memberships and imported advertising data.
--
-- Authorisation root: a user can read or write a row only when they are a
-- member of the row's workspace (public.is_workspace_member). Every data table
-- carries workspace_id and client_id, and composite foreign keys keep a child
-- in the same workspace and client as its parent, so a row can never point
-- across tenants even though foreign-key checks bypass RLS.
--
-- Demo data is not stored here; it is generated in code for demo mode only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('ecommerce', 'lead_generation', 'saas')),
  currency text not null check (currency in ('GBP', 'USD', 'EUR')),
  timezone text not null check (char_length(timezone) between 1 and 64),
  target_cpa numeric(14, 2) check (target_cpa is null or target_cpa > 0),
  target_roas numeric(10, 2) check (target_roas is null or target_roas > 0),
  revenue_tracked boolean not null default false,
  source text not null default 'meta_csv' check (source in ('meta_csv')),
  primary_conversion_column text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_roas_needs_revenue check (target_roas is null or revenue_tracked),
  unique (workspace_id, id)
);
create unique index clients_workspace_name_key on public.clients (workspace_id, lower(name));

create table public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  platform text not null default 'meta' check (platform in ('meta')),
  external_id text,
  name text not null,
  currency text not null check (currency in ('GBP', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  unique (client_id, platform),
  unique (workspace_id, client_id, id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  ad_account_id uuid not null,
  source_key text not null,
  external_id text,
  name text not null,
  objective text check (objective in ('sales', 'leads', 'traffic', 'awareness', 'engagement')),
  status text not null check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  foreign key (workspace_id, client_id, ad_account_id)
    references public.ad_accounts (workspace_id, client_id, id) on delete cascade,
  unique (client_id, source_key),
  unique (workspace_id, client_id, id)
);
create index campaigns_ad_account_idx on public.campaigns (ad_account_id);

create table public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  campaign_id uuid not null,
  source_key text not null,
  external_id text,
  name text not null,
  audience text not null default '',
  status text not null check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, client_id, campaign_id)
    references public.campaigns (workspace_id, client_id, id) on delete cascade,
  unique (client_id, source_key),
  unique (workspace_id, client_id, id)
);
create index ad_sets_campaign_idx on public.ad_sets (campaign_id);

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  source_key text not null,
  external_id text,
  name text not null,
  type text not null check (type in ('image', 'video', 'carousel', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  unique (client_id, source_key),
  unique (workspace_id, client_id, id)
);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  ad_set_id uuid not null,
  creative_id uuid not null,
  source_key text not null,
  external_id text,
  name text not null,
  status text not null check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, client_id, ad_set_id)
    references public.ad_sets (workspace_id, client_id, id) on delete cascade,
  foreign key (workspace_id, client_id, creative_id)
    references public.creatives (workspace_id, client_id, id) on delete cascade,
  unique (client_id, source_key),
  unique (workspace_id, client_id, id)
);
create index ads_ad_set_idx on public.ads (ad_set_id);
create index ads_creative_idx on public.ads (creative_id);

-- One row per ad per day: the identity that prevents double counting.
create table public.daily_metrics (
  workspace_id uuid not null,
  client_id uuid not null,
  ad_id uuid not null,
  date date not null,
  spend numeric(16, 4) not null default 0 check (spend >= 0),
  revenue numeric(16, 4) not null default 0 check (revenue >= 0),
  conversions numeric(16, 4) not null default 0 check (conversions >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (ad_id, date),
  foreign key (workspace_id, client_id, ad_id)
    references public.ads (workspace_id, client_id, id) on delete cascade
);
create index daily_metrics_client_date_idx on public.daily_metrics (client_id, date);
create index daily_metrics_workspace_idx on public.daily_metrics (workspace_id);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  source_type text not null default 'meta_csv' check (source_type in ('meta_csv')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_bytes bigint not null check (file_bytes >= 0),
  row_count integer not null check (row_count >= 0),
  imported_at timestamptz not null default now(),
  imported_by uuid default auth.uid() references auth.users (id) on delete set null,
  date_start date not null,
  date_end date not null,
  account_external_id text,
  currency text not null check (currency in ('GBP', 'USD', 'EUR')),
  outcome_column text not null,
  revenue_column text,
  new_ad_days integer not null check (new_ad_days >= 0),
  updated_ad_days integer not null check (updated_ad_days >= 0),
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  check (date_end >= date_start)
);
create index imports_client_imported_idx on public.imports (client_id, imported_at desc);
create index imports_workspace_idx on public.imports (workspace_id);

-- ---------------------------------------------------------------------------
-- Authorisation helper
-- ---------------------------------------------------------------------------

-- Security definer so policies on workspace_members do not recurse.
create function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.creatives enable row level security;
alter table public.ads enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.imports enable row level security;

create policy workspaces_member_read on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy workspace_members_read on public.workspace_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy clients_member_all on public.clients
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy ad_accounts_member_all on public.ad_accounts
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy campaigns_member_all on public.campaigns
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy ad_sets_member_all on public.ad_sets
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy creatives_member_all on public.creatives
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy ads_member_all on public.ads
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy daily_metrics_member_all on public.daily_metrics
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
-- Import records are an audit trail: members may read and append, never edit.
create policy imports_member_read on public.imports
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy imports_member_insert on public.imports
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

revoke all on public.workspaces, public.workspace_members, public.clients, public.ad_accounts,
  public.campaigns, public.ad_sets, public.creatives, public.ads, public.daily_metrics,
  public.imports from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.clients, public.ad_accounts, public.campaigns,
  public.ad_sets, public.creatives, public.ads, public.daily_metrics to authenticated;
grant select, insert on public.imports to authenticated;

-- ---------------------------------------------------------------------------
-- First sign-in: a personal workspace
-- ---------------------------------------------------------------------------

-- Creates one workspace (owner membership) for a user with none, then returns
-- every workspace the user belongs to, oldest membership first. Security
-- definer because a user cannot insert memberships under RLS.
create function public.ensure_default_workspace(p_name text)
returns table (id uuid, name text, role text, joined_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Two first requests at once must not create two workspaces.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if not exists (select 1 from public.workspace_members m where m.user_id = v_user) then
    insert into public.workspaces (name, created_by)
    values (left(coalesce(nullif(btrim(p_name), ''), 'My workspace'), 120), v_user)
    returning workspaces.id into v_workspace;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace, v_user, 'owner');
  end if;
  return query
    select w.id, w.name, m.role, m.created_at
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = v_user
    order by m.created_at, w.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read model: one workspace, heavy data for one client
-- ---------------------------------------------------------------------------

-- Security invoker: RLS applies to every table read here. Returns the
-- workspace's clients, accounts, import records and per-client coverage, plus
-- campaigns, ad sets, creatives, ads and recent daily metrics for the
-- requested client, or for the first client when the requested one is not in
-- this workspace (a stale or forged selection never crosses workspaces).
create function public.workspace_snapshot(p_workspace_id uuid, p_client_id uuid default null, p_days integer default 120)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_client uuid;
  v_last date;
  v_since date;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace not available' using errcode = '42501';
  end if;
  select c.id into v_client from public.clients c
  where c.workspace_id = p_workspace_id and c.id = p_client_id;
  if v_client is null then
    select c.id into v_client from public.clients c
    where c.workspace_id = p_workspace_id
    order by c.created_at, c.name, c.id
    limit 1;
  end if;
  select max(d.date) into v_last from public.daily_metrics d where d.client_id = v_client;
  v_since := least(coalesce(v_last, current_date), current_date) - greatest(p_days, 1);

  return jsonb_build_object(
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name) from public.workspaces w where w.id = p_workspace_id),
    'client_id', v_client,
    'clients', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at, c.name, c.id) from public.clients c where c.workspace_id = p_workspace_id), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.ad_accounts a where a.workspace_id = p_workspace_id), '[]'::jsonb),
    'imports', coalesce((select jsonb_agg(to_jsonb(i) order by i.imported_at desc) from public.imports i where i.workspace_id = p_workspace_id), '[]'::jsonb),
    'coverage', coalesce((
      select jsonb_agg(cov.item) from (
        select jsonb_build_object('client_id', d.client_id, 'first_date', min(d.date), 'last_date', max(d.date), 'days', count(distinct d.date), 'rows', count(*)) as item
        from public.daily_metrics d where d.workspace_id = p_workspace_id group by d.client_id
      ) cov
    ), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.campaigns x where x.client_id = v_client), '[]'::jsonb),
    'ad_sets', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.ad_sets x where x.client_id = v_client), '[]'::jsonb),
    'creatives', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.creatives x where x.client_id = v_client), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.ads x where x.client_id = v_client), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('ad_id', d.ad_id, 'date', d.date, 'spend', d.spend, 'revenue', d.revenue, 'conversions', d.conversions, 'impressions', d.impressions, 'clicks', d.clicks) order by d.date, d.ad_id)
      from public.daily_metrics d where d.client_id = v_client and d.date >= v_since
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Import: one transaction for the client, hierarchy, metrics and record
-- ---------------------------------------------------------------------------

-- Security invoker: RLS and the composite foreign keys apply to every write.
-- A function call is one transaction, so any failure (unknown key, constraint,
-- another tenant's client) rolls the whole import back. Entities upsert on
-- (client_id, source_key); daily metrics upsert on (ad_id, date), replacing the
-- ad-days the file contains and keeping every other stored day.
create function public.import_meta_csv(p_workspace_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client uuid;
  v_account uuid;
  v_existing_external text;
  v_payload_external text := nullif(p_payload #>> '{account,external_id}', '');
  v_expected integer := jsonb_array_length(coalesce(p_payload -> 'metrics', '[]'::jsonb));
  v_resolved integer;
  v_replaced integer;
  v_import uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace not available' using errcode = '42501';
  end if;

  if p_payload #>> '{client,mode}' = 'new' then
    insert into public.clients (workspace_id, name, type, currency, timezone, target_cpa, target_roas, revenue_tracked, primary_conversion_column)
    values (
      p_workspace_id,
      p_payload #>> '{client,name}',
      p_payload #>> '{client,type}',
      p_payload #>> '{client,currency}',
      p_payload #>> '{client,timezone}',
      nullif(p_payload #>> '{client,target_cpa}', '')::numeric,
      nullif(p_payload #>> '{client,target_roas}', '')::numeric,
      coalesce((p_payload #>> '{client,revenue_tracked}')::boolean, false),
      p_payload #>> '{import,outcome_column}'
    )
    returning id into v_client;
  else
    select c.id into v_client from public.clients c
    where c.id = (p_payload #>> '{client,id}')::uuid and c.workspace_id = p_workspace_id;
    if v_client is null then
      raise exception 'client not available' using errcode = 'P0002';
    end if;
    update public.clients set primary_conversion_column = p_payload #>> '{import,outcome_column}', updated_at = now()
    where id = v_client;
  end if;

  select a.id, a.external_id into v_account, v_existing_external
  from public.ad_accounts a where a.client_id = v_client and a.platform = 'meta';
  if v_account is null then
    insert into public.ad_accounts (workspace_id, client_id, platform, external_id, name, currency)
    values (p_workspace_id, v_client, 'meta', v_payload_external, p_payload #>> '{account,name}', p_payload #>> '{import,currency}')
    returning id into v_account;
  elsif v_existing_external is not null and v_payload_external is not null and v_existing_external <> v_payload_external then
    raise exception 'account mismatch' using errcode = 'P0003';
  elsif v_existing_external is null and v_payload_external is not null then
    update public.ad_accounts set external_id = v_payload_external, name = p_payload #>> '{account,name}', updated_at = now()
    where id = v_account;
  end if;

  insert into public.campaigns (workspace_id, client_id, ad_account_id, source_key, external_id, name, objective, status)
  select p_workspace_id, v_client, v_account, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', nullif(e ->> 'objective', ''), e ->> 'status'
  from jsonb_array_elements(coalesce(p_payload -> 'campaigns', '[]'::jsonb)) e
  on conflict (client_id, source_key) do update
    set name = excluded.name, objective = excluded.objective, status = excluded.status,
        external_id = coalesce(excluded.external_id, public.campaigns.external_id), updated_at = now();

  insert into public.ad_sets (workspace_id, client_id, campaign_id, source_key, external_id, name, status)
  select p_workspace_id, v_client, c.id, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'status'
  from jsonb_array_elements(coalesce(p_payload -> 'ad_sets', '[]'::jsonb)) e
  join public.campaigns c on c.client_id = v_client and c.source_key = e ->> 'campaign_key'
  on conflict (client_id, source_key) do update
    set campaign_id = excluded.campaign_id, name = excluded.name, status = excluded.status,
        external_id = coalesce(excluded.external_id, public.ad_sets.external_id), updated_at = now();

  insert into public.creatives (workspace_id, client_id, source_key, external_id, name, type)
  select p_workspace_id, v_client, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'type'
  from jsonb_array_elements(coalesce(p_payload -> 'creatives', '[]'::jsonb)) e
  on conflict (client_id, source_key) do update
    set name = excluded.name,
        type = case when excluded.type = 'unknown' then public.creatives.type else excluded.type end,
        external_id = coalesce(excluded.external_id, public.creatives.external_id), updated_at = now();

  insert into public.ads (workspace_id, client_id, ad_set_id, creative_id, source_key, external_id, name, status)
  select p_workspace_id, v_client, s.id, cr.id, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'status'
  from jsonb_array_elements(coalesce(p_payload -> 'ads', '[]'::jsonb)) e
  join public.ad_sets s on s.client_id = v_client and s.source_key = e ->> 'ad_set_key'
  join public.creatives cr on cr.client_id = v_client and cr.source_key = e ->> 'creative_key'
  on conflict (client_id, source_key) do update
    set ad_set_id = excluded.ad_set_id, creative_id = excluded.creative_id, name = excluded.name,
        status = excluded.status, external_id = coalesce(excluded.external_id, public.ads.external_id), updated_at = now();

  -- Every metric row must resolve to an ad of this client, or nothing is kept.
  select count(*), count(d.ad_id) into v_resolved, v_replaced
  from jsonb_array_elements(coalesce(p_payload -> 'metrics', '[]'::jsonb)) e
  join public.ads a on a.client_id = v_client and a.source_key = e ->> 'ad_key'
  left join public.daily_metrics d on d.ad_id = a.id and d.date = (e ->> 'date')::date;
  if v_resolved <> v_expected then
    raise exception 'metrics reference unknown ads (% of % resolved)', v_resolved, v_expected using errcode = 'P0004';
  end if;

  insert into public.daily_metrics (workspace_id, client_id, ad_id, date, spend, revenue, conversions, impressions, clicks)
  select p_workspace_id, v_client, a.id, (e ->> 'date')::date, (e ->> 'spend')::numeric, (e ->> 'revenue')::numeric,
         (e ->> 'conversions')::numeric, (e ->> 'impressions')::bigint, (e ->> 'clicks')::bigint
  from jsonb_array_elements(coalesce(p_payload -> 'metrics', '[]'::jsonb)) e
  join public.ads a on a.client_id = v_client and a.source_key = e ->> 'ad_key'
  on conflict (ad_id, date) do update
    set spend = excluded.spend, revenue = excluded.revenue, conversions = excluded.conversions,
        impressions = excluded.impressions, clicks = excluded.clicks, updated_at = now();

  insert into public.imports (workspace_id, client_id, file_name, file_bytes, row_count, date_start, date_end,
    account_external_id, currency, outcome_column, revenue_column, new_ad_days, updated_ad_days)
  values (
    p_workspace_id, v_client,
    p_payload #>> '{import,file_name}',
    (p_payload #>> '{import,file_bytes}')::bigint,
    (p_payload #>> '{import,row_count}')::integer,
    (p_payload #>> '{import,date_start}')::date,
    (p_payload #>> '{import,date_end}')::date,
    v_payload_external,
    p_payload #>> '{import,currency}',
    p_payload #>> '{import,outcome_column}',
    nullif(p_payload #>> '{import,revenue_column}', ''),
    v_expected - v_replaced,
    v_replaced
  )
  returning id into v_import;

  return jsonb_build_object('client_id', v_client, 'import_id', v_import, 'days_added', v_expected - v_replaced, 'days_replaced', v_replaced);
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings: optional targets
-- ---------------------------------------------------------------------------

-- Security invoker: the update only reaches clients in the caller's
-- workspaces. Returns false when the client is not visible.
create function public.update_client_targets(p_client_id uuid, p_target_cpa numeric, p_target_roas numeric)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update public.clients
  set target_cpa = p_target_cpa, target_roas = p_target_roas, updated_at = now()
  where id = p_client_id
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.ensure_default_workspace(text) from public, anon;
revoke all on function public.workspace_snapshot(uuid, uuid, integer) from public, anon;
revoke all on function public.import_meta_csv(uuid, jsonb) from public, anon;
revoke all on function public.update_client_targets(uuid, numeric, numeric) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.ensure_default_workspace(text) to authenticated;
grant execute on function public.workspace_snapshot(uuid, uuid, integer) to authenticated;
grant execute on function public.import_meta_csv(uuid, jsonb) to authenticated;
grant execute on function public.update_client_targets(uuid, numeric, numeric) to authenticated;
