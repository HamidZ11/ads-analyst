-- Ad Analyst: per-workspace subscription state, written only by the Stripe
-- webhook (D-083).
--
-- The webhook has no user session and the app has no service-role key
-- (D-051). It calls the database as `anon` with the publishable key, and the
-- one function it may call, apply_billing_event, refuses to do anything
-- unless the caller presents the webhook's database secret. Only a SHA-256
-- hash of that secret is stored, in a table nobody can read; the owner sets
-- it once in the SQL editor (docs/BILLING.md):
--
--   insert into public.billing_webhook_secret (secret_hash)
--   values (sha256(convert_to('<BILLING_WEBHOOK_DB_SECRET>', 'UTF8')))
--   on conflict (id) do update set secret_hash = excluded.secret_hash, created_at = now();
--
-- Members read their workspace's subscription through RLS, exactly like
-- every other table. Nobody writes it directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per workspace that has ever started a Stripe subscription. Values
-- mirror Stripe's subscription as last fetched from the Stripe API.
create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]{1,250}$'),
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]{1,250}$'),
  -- 'agency' for the configured Agency prices; 'custom' for anything else
  -- (an Enterprise subscription set up by hand in Stripe).
  plan text not null check (plan in ('agency', 'custom')),
  "interval" text check ("interval" in ('month', 'year')),
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Every Stripe event the webhook has applied, so a redelivery is a no-op.
create table public.billing_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9]{1,250}$'),
  type text not null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- What apply_billing_event did with it: applied, ignored, unlinked, stale
  -- or conflict ('processing' only inside the call that records it).
  outcome text not null,
  processed_at timestamptz not null default now()
);

-- The hash of the webhook's database secret. At most one row.
create table public.billing_webhook_secret (
  id boolean primary key default true check (id),
  secret_hash bytea not null check (octet_length(secret_hash) = 32),
  created_at timestamptz not null default now()
);

alter table public.workspace_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_webhook_secret enable row level security;

create policy workspace_subscriptions_member_read on public.workspace_subscriptions
  for select to authenticated using (public.is_workspace_member(workspace_id));

revoke all on public.workspace_subscriptions, public.billing_events, public.billing_webhook_secret
  from public, anon, authenticated;
grant select on public.workspace_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- The webhook's write path
-- ---------------------------------------------------------------------------

-- Applies one verified Stripe event. The app calls it only after checking the
-- Stripe signature and fetching the subscription from Stripe, but the
-- function trusts none of that: it requires the secret, validates every
-- value, and runs in one transaction, so the event is recorded if and only if
-- its state was handled.
--
-- p_state is null for an event with nothing to write, or:
--   { workspace_id (uuid or null), customer_id, subscription_id, plan,
--     interval, status, current_period_end (ISO timestamp or null),
--     cancel_at_period_end }
--
-- Returns the outcome:
--   duplicate  the event was already processed; nothing changes
--   ignored    nothing to write (recorded)
--   applied    the workspace's subscription now matches p_state
--   unlinked   no workspace could be found for it (recorded, nothing written)
--   stale      an ended subscription would overwrite the workspace's newer,
--              live one (recorded, nothing written)
--   conflict   the Stripe customer or subscription already belongs to
--              another workspace (recorded, nothing written)
create function public.apply_billing_event(
  p_secret text,
  p_event_id text,
  p_event_type text,
  p_state jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_requested text := p_state ->> 'workspace_id';
  v_customer text := p_state ->> 'customer_id';
  v_subscription text := p_state ->> 'subscription_id';
  v_status text := p_state ->> 'status';
  v_period_end timestamptz;
  v_existing public.workspace_subscriptions%rowtype;
  v_outcome text;
begin
  -- The caller: only the holder of the webhook secret. Compared as hashes,
  -- and refused outright when no secret has been configured.
  if p_secret is null or char_length(p_secret) < 32 or not exists (
       select 1 from public.billing_webhook_secret s
       where s.secret_hash = pg_catalog.sha256(pg_catalog.convert_to(p_secret, 'UTF8'))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- The event.
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]{1,250}$'
     or p_event_type is null or p_event_type not in ('checkout.session.completed',
       'customer.subscription.created', 'customer.subscription.updated',
       'customer.subscription.deleted', 'invoice.payment_failed') then
    raise exception 'invalid billing event' using errcode = '22023';
  end if;

  -- The state, before anything is written.
  if p_state is not null then
    if jsonb_typeof(p_state) is distinct from 'object'
       or (v_requested is not null and v_requested !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       or coalesce(v_customer, '') !~ '^cus_[A-Za-z0-9]{1,250}$'
       or coalesce(v_subscription, '') !~ '^sub_[A-Za-z0-9]{1,250}$'
       or coalesce(p_state ->> 'plan', '') not in ('agency', 'custom')
       or (p_state ->> 'interval') not in ('month', 'year')
       or coalesce(v_status, '') not in ('incomplete', 'incomplete_expired', 'trialing', 'active',
         'past_due', 'canceled', 'unpaid', 'paused')
       or jsonb_typeof(p_state -> 'cancel_at_period_end') is distinct from 'boolean'
       or (p_state ->> 'current_period_end' is not null
           and p_state ->> 'current_period_end' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$') then
      raise exception 'invalid billing state' using errcode = '22023';
    end if;
    v_period_end := (p_state ->> 'current_period_end')::timestamptz;
  end if;

  -- Idempotency: the first delivery claims the event id; a concurrent or
  -- later delivery of the same event stops here.
  insert into public.billing_events (id, type, outcome)
  values (p_event_id, p_event_type, 'processing')
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_state is null then
    v_outcome := 'ignored';
  else
    -- Which workspace: the one our checkout named in the metadata, or else
    -- the one already holding this subscription or customer.
    if v_requested is not null then
      select w.id into v_workspace from public.workspaces w where w.id = v_requested::uuid;
    else
      select s.workspace_id into v_workspace from public.workspace_subscriptions s
      where s.stripe_subscription_id = v_subscription or s.stripe_customer_id = v_customer
      order by (s.stripe_subscription_id = v_subscription) desc
      limit 1;
    end if;

    if v_workspace is null then
      v_outcome := 'unlinked';
    elsif exists (
        select 1 from public.workspace_subscriptions s
        where s.workspace_id <> v_workspace
          and (s.stripe_customer_id = v_customer or s.stripe_subscription_id = v_subscription)) then
      v_outcome := 'conflict';
    else
      select * into v_existing from public.workspace_subscriptions s where s.workspace_id = v_workspace;
      -- A late event about an older, ended subscription must not replace the
      -- workspace's current one.
      if found and v_existing.stripe_subscription_id <> v_subscription
         and v_existing.status not in ('canceled', 'incomplete_expired')
         and v_status in ('canceled', 'incomplete_expired') then
        v_outcome := 'stale';
      else
        insert into public.workspace_subscriptions as s (workspace_id, stripe_customer_id,
          stripe_subscription_id, plan, "interval", status, current_period_end, cancel_at_period_end, updated_at)
        values (v_workspace, v_customer, v_subscription, p_state ->> 'plan', p_state ->> 'interval',
          v_status, v_period_end, (p_state ->> 'cancel_at_period_end')::boolean, now())
        on conflict (workspace_id) do update
          set stripe_customer_id = excluded.stripe_customer_id,
              stripe_subscription_id = excluded.stripe_subscription_id,
              plan = excluded.plan, "interval" = excluded."interval", status = excluded.status,
              current_period_end = excluded.current_period_end,
              cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();
        v_outcome := 'applied';
      end if;
    end if;
  end if;

  update public.billing_events set outcome = v_outcome, workspace_id = v_workspace
  where id = p_event_id;
  return v_outcome;
end;
$$;

-- The webhook calls as anon (publishable key, no session). Every other role
-- is refused at the grant; anon is refused inside without the secret.
revoke all on function public.apply_billing_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_billing_event(text, text, text, jsonb) to anon;
