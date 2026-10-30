-- Ad Analyst: the 7-day grace period always starts at the first failed
-- payment (D-NEW-fixes-grace-1, amending D-089).
--
-- 20261030130000_billing_grace_period.sql set payment_failed_at only while
-- handling invoice.payment_failed. When that event was read while the
-- subscription still showed active, and past_due arrived later through
-- customer.subscription.updated, nothing was set and gated imports stopped
-- with no grace. Now any event that moves the subscription into past_due or
-- unpaid sets it too, keeping the earliest time. Only that expression and
-- the matching insert value change.

create or replace function public.apply_billing_event(
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
          stripe_subscription_id, plan, "interval", status, current_period_end, cancel_at_period_end,
          payment_failed_at, updated_at)
        values (v_workspace, v_customer, v_subscription, p_state ->> 'plan', p_state ->> 'interval',
          v_status, v_period_end, (p_state ->> 'cancel_at_period_end')::boolean,
          case when v_status not in ('active', 'trialing')
              and (p_event_type = 'invoice.payment_failed' or v_status in ('past_due', 'unpaid'))
            then now() end,
          now())
        on conflict (workspace_id) do update
          set stripe_customer_id = excluded.stripe_customer_id,
              stripe_subscription_id = excluded.stripe_subscription_id,
              plan = excluded.plan, "interval" = excluded."interval", status = excluded.status,
              current_period_end = excluded.current_period_end,
              cancel_at_period_end = excluded.cancel_at_period_end,
              -- The grace period runs from the first failure of an episode:
              -- Stripe's retries don't extend it, a paid or trialing status
              -- ends it, and a different subscription starts afresh. The
              -- failure counts whichever event first shows it, so a
              -- payment_failed read while still active followed by an update
              -- to past_due starts the grace too.
              payment_failed_at = case
                when excluded.status in ('active', 'trialing') then null
                when s.stripe_subscription_id <> excluded.stripe_subscription_id
                  then excluded.payment_failed_at
                when p_event_type = 'invoice.payment_failed'
                  or excluded.status in ('past_due', 'unpaid')
                  then coalesce(s.payment_failed_at, now())
                else s.payment_failed_at
              end,
              updated_at = now();
        v_outcome := 'applied';
      end if;
    end if;
  end if;

  update public.billing_events set outcome = v_outcome, workspace_id = v_workspace
  where id = p_event_id;
  return v_outcome;
end;
$$;

revoke all on function public.apply_billing_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_billing_event(text, text, text, jsonb) to anon;
