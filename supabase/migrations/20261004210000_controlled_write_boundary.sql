-- Ad Analyst: one controlled write boundary.
--
-- Signed-in users could write the data tables directly through the Data API,
-- with their own session and the public key. RLS kept them inside their own
-- workspace, but direct writes skipped import validation and limits. From
-- here on, authenticated users read tables directly and write only through
-- these functions, which check the caller, their membership and the input:
--
--   ensure_default_workspace  workspaces, workspace_members (unchanged)
--   import_meta_csv           clients, ad_accounts, campaigns, ad_sets,
--                             creatives, ads, daily_metrics, imports
--   update_client_targets     clients (targets only)
--   consume_rate_limit        rate_limits
--
-- import_meta_csv and update_client_targets become security definer (owner
-- rights, empty search_path) because callers no longer hold write
-- privileges; owner rights skip RLS, so each one checks membership itself.
-- The RLS policies are unchanged: they still govern every read, and they
-- would confine writes again if a write privilege were ever restored.

-- ---------------------------------------------------------------------------
-- Grants: read only, and only what workspace_snapshot reads
-- ---------------------------------------------------------------------------

revoke all on public.workspaces, public.workspace_members, public.clients, public.ad_accounts,
  public.campaigns, public.ad_sets, public.creatives, public.ads, public.daily_metrics,
  public.imports from anon, authenticated;
-- workspace_members is read only by security definer functions, so it gets nothing.
grant select on public.workspaces, public.clients, public.ad_accounts, public.campaigns,
  public.ad_sets, public.creatives, public.ads, public.daily_metrics, public.imports
  to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits: committed imports, counted inside the import transaction
-- ---------------------------------------------------------------------------

-- Adds 'import_write'. 'import' (attempts, spent by /api/import before it
-- reads a file) is unchanged.
create or replace function public.consume_rate_limit(p_action text)
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
    -- Imports written by import_meta_csv, whoever calls it. Counted in the
    -- import's own transaction, so a refused or failed import is not counted.
    when 'import_write' then v_limit := 30; v_window := interval '1 hour';
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

-- ---------------------------------------------------------------------------
-- Import: validated in the database, then written in one transaction
-- ---------------------------------------------------------------------------

-- The same write as before (D-053), now with owner rights and its own checks.
-- Limits mirror the importer, so nothing it produces is refused: at most
-- 100,000 CSV rows, names cut to 300 characters, platform IDs to 64, header
-- cells to 2,000, files up to 10 MB. Metric values must be JSON numbers (a
-- string such as "NaN" would otherwise cast to numeric NaN). Dates may be in
-- the future: the importer only warns about those. Enumerations, signs and
-- numeric ranges are enforced by the table constraints. Any failure rolls
-- the whole call back.
create or replace function public.import_meta_csv(p_workspace_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_mode text := p_payload #>> '{client,mode}';
  v_target_cpa numeric;
  v_target_roas numeric;
  v_client uuid;
  v_account uuid;
  v_existing_external text;
  v_payload_external text := nullif(p_payload #>> '{account,external_id}', '');
  v_expected integer;
  v_resolved integer;
  v_replaced integer;
  v_import uuid;
begin
  -- Caller and workspace.
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace not available' using errcode = '42501';
  end if;

  -- Shape and size, before any write.
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload -> 'client') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'account') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'import') is distinct from 'object'
     or v_mode is null or v_mode not in ('new', 'existing') then
    raise exception 'invalid import payload' using errcode = '22023';
  end if;
  foreach v_key in array array['campaigns', 'ad_sets', 'creatives', 'ads', 'metrics'] loop
    if jsonb_typeof(p_payload -> v_key) is distinct from 'array'
       or jsonb_array_length(p_payload -> v_key) > 100000 then
      raise exception 'invalid import payload: %', v_key using errcode = '22023';
    end if;
  end loop;
  v_expected := jsonb_array_length(p_payload -> 'metrics');
  if v_expected = 0 then
    raise exception 'import has no rows' using errcode = '22023';
  end if;

  if exists (
       select 1 from jsonb_array_elements(p_payload -> 'campaigns') e
       where char_length(coalesce(e ->> 'key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'name', '')) > 300
          or char_length(coalesce(e ->> 'external_id', '')) > 64)
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'ad_sets') e
       where char_length(coalesce(e ->> 'key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'campaign_key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'name', '')) > 300
          or char_length(coalesce(e ->> 'external_id', '')) > 64)
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'creatives') e
       where char_length(coalesce(e ->> 'key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'name', '')) > 300
          or char_length(coalesce(e ->> 'external_id', '')) > 64)
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'ads') e
       where char_length(coalesce(e ->> 'key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'ad_set_key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'creative_key', '')) not between 1 and 64
          or char_length(coalesce(e ->> 'name', '')) > 300
          or char_length(coalesce(e ->> 'external_id', '')) > 64)
     or exists (
       select 1 from jsonb_array_elements(p_payload -> 'metrics') e
       where char_length(coalesce(e ->> 'ad_key', '')) not between 1 and 64
          or coalesce(e ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or jsonb_typeof(e -> 'spend') is distinct from 'number'
          or jsonb_typeof(e -> 'revenue') is distinct from 'number'
          or jsonb_typeof(e -> 'conversions') is distinct from 'number'
          or jsonb_typeof(e -> 'impressions') is distinct from 'number'
          or jsonb_typeof(e -> 'clicks') is distinct from 'number') then
    raise exception 'invalid import rows' using errcode = '22023';
  end if;

  if char_length(coalesce(p_payload #>> '{account,name}', '')) > 300
     or char_length(coalesce(v_payload_external, '')) > 64
     or char_length(coalesce(p_payload #>> '{import,outcome_column}', '')) > 2000
     or char_length(coalesce(p_payload #>> '{import,revenue_column}', '')) > 2000
     or jsonb_typeof(p_payload #> '{import,file_bytes}') is distinct from 'number'
     or (p_payload #>> '{import,file_bytes}')::numeric not between 0 and 10485760
     or jsonb_typeof(p_payload #> '{import,row_count}') is distinct from 'number'
     or (p_payload #>> '{import,row_count}')::numeric not between 0 and 100000 then
    raise exception 'invalid import record' using errcode = '22023';
  end if;

  if v_mode = 'new' then
    v_target_cpa := nullif(p_payload #>> '{client,target_cpa}', '')::numeric;
    v_target_roas := nullif(p_payload #>> '{client,target_roas}', '')::numeric;
    if (v_target_cpa is not null and (v_target_cpa <= 0 or v_target_cpa > 1000000))
       or (v_target_roas is not null and (v_target_roas <= 0 or v_target_roas > 1000))
       or not exists (
         select 1 from pg_catalog.pg_timezone_names z
         where lower(z.name) = lower(p_payload #>> '{client,timezone}')) then
      raise exception 'invalid client' using errcode = '22023';
    end if;
  end if;

  -- A controlled number of written imports per user and hour. Counted in this
  -- transaction: if anything below fails, the count rolls back with it.
  if not public.consume_rate_limit('import_write') then
    raise exception 'import limit reached' using errcode = 'P0005';
  end if;

  -- The write, unchanged from D-053 apart from naming the importing user.
  if v_mode = 'new' then
    insert into public.clients (workspace_id, name, type, currency, timezone, target_cpa, target_roas, revenue_tracked, primary_conversion_column)
    values (
      p_workspace_id,
      p_payload #>> '{client,name}',
      p_payload #>> '{client,type}',
      p_payload #>> '{client,currency}',
      p_payload #>> '{client,timezone}',
      v_target_cpa,
      v_target_roas,
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
  from jsonb_array_elements(p_payload -> 'campaigns') e
  on conflict (client_id, source_key) do update
    set name = excluded.name, objective = excluded.objective, status = excluded.status,
        external_id = coalesce(excluded.external_id, public.campaigns.external_id), updated_at = now();

  insert into public.ad_sets (workspace_id, client_id, campaign_id, source_key, external_id, name, status)
  select p_workspace_id, v_client, c.id, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'status'
  from jsonb_array_elements(p_payload -> 'ad_sets') e
  join public.campaigns c on c.client_id = v_client and c.source_key = e ->> 'campaign_key'
  on conflict (client_id, source_key) do update
    set campaign_id = excluded.campaign_id, name = excluded.name, status = excluded.status,
        external_id = coalesce(excluded.external_id, public.ad_sets.external_id), updated_at = now();

  insert into public.creatives (workspace_id, client_id, source_key, external_id, name, type)
  select p_workspace_id, v_client, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'type'
  from jsonb_array_elements(p_payload -> 'creatives') e
  on conflict (client_id, source_key) do update
    set name = excluded.name,
        type = case when excluded.type = 'unknown' then public.creatives.type else excluded.type end,
        external_id = coalesce(excluded.external_id, public.creatives.external_id), updated_at = now();

  insert into public.ads (workspace_id, client_id, ad_set_id, creative_id, source_key, external_id, name, status)
  select p_workspace_id, v_client, s.id, cr.id, e ->> 'key', nullif(e ->> 'external_id', ''), e ->> 'name', e ->> 'status'
  from jsonb_array_elements(p_payload -> 'ads') e
  join public.ad_sets s on s.client_id = v_client and s.source_key = e ->> 'ad_set_key'
  join public.creatives cr on cr.client_id = v_client and cr.source_key = e ->> 'creative_key'
  on conflict (client_id, source_key) do update
    set ad_set_id = excluded.ad_set_id, creative_id = excluded.creative_id, name = excluded.name,
        status = excluded.status, external_id = coalesce(excluded.external_id, public.ads.external_id), updated_at = now();

  -- Every metric row must resolve to an ad of this client, or nothing is kept.
  select count(*), count(d.ad_id) into v_resolved, v_replaced
  from jsonb_array_elements(p_payload -> 'metrics') e
  join public.ads a on a.client_id = v_client and a.source_key = e ->> 'ad_key'
  left join public.daily_metrics d on d.ad_id = a.id and d.date = (e ->> 'date')::date;
  if v_resolved <> v_expected then
    raise exception 'metrics reference unknown ads (% of % resolved)', v_resolved, v_expected using errcode = 'P0004';
  end if;

  insert into public.daily_metrics (workspace_id, client_id, ad_id, date, spend, revenue, conversions, impressions, clicks)
  select p_workspace_id, v_client, a.id, (e ->> 'date')::date, (e ->> 'spend')::numeric, (e ->> 'revenue')::numeric,
         (e ->> 'conversions')::numeric, (e ->> 'impressions')::bigint, (e ->> 'clicks')::bigint
  from jsonb_array_elements(p_payload -> 'metrics') e
  join public.ads a on a.client_id = v_client and a.source_key = e ->> 'ad_key'
  on conflict (ad_id, date) do update
    set spend = excluded.spend, revenue = excluded.revenue, conversions = excluded.conversions,
        impressions = excluded.impressions, clicks = excluded.clicks, updated_at = now();

  insert into public.imports (workspace_id, client_id, file_name, file_bytes, row_count, date_start, date_end,
    account_external_id, currency, outcome_column, revenue_column, new_ad_days, updated_ad_days, imported_by)
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
    v_replaced,
    v_user
  )
  returning id into v_import;

  return jsonb_build_object('client_id', v_client, 'import_id', v_import, 'days_added', v_expected - v_replaced, 'days_replaced', v_replaced);
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings: optional targets
-- ---------------------------------------------------------------------------

-- Owner rights, so membership of the client's own workspace is checked in the
-- update itself. Ranges mirror the settings form. Returns false when the
-- client does not exist or the caller is not a member of its workspace.
create or replace function public.update_client_targets(p_client_id uuid, p_target_cpa numeric, p_target_roas numeric)
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
  if (p_target_cpa is not null and (p_target_cpa <= 0 or p_target_cpa > 1000000))
     or (p_target_roas is not null and (p_target_roas <= 0 or p_target_roas > 1000)) then
    raise exception 'target out of range' using errcode = '22023';
  end if;
  update public.clients c
  set target_cpa = p_target_cpa, target_roas = p_target_roas, updated_at = now()
  where c.id = p_client_id and public.is_workspace_member(c.workspace_id)
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

-- create or replace keeps existing privileges; restated so a fresh database
-- ends in the same state.
revoke all on function public.consume_rate_limit(text) from public, anon;
revoke all on function public.import_meta_csv(uuid, jsonb) from public, anon;
revoke all on function public.update_client_targets(uuid, numeric, numeric) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
grant execute on function public.import_meta_csv(uuid, jsonb) to authenticated;
grant execute on function public.update_client_targets(uuid, numeric, numeric) to authenticated;
