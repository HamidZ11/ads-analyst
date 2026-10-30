-- Ad Analyst: client reports.
--
-- A client report is computed on request from the stored daily metrics; only
-- the agency's own words are stored: the "What we're doing next" note, one
-- per client and reporting period. The workspace name, which heads every
-- report, becomes editable by the workspace's owners.
--
-- Same boundary as before (D-053, 20261004210000): authenticated users read
-- through RLS and write only through security definer functions that check
-- membership themselves.

-- ---------------------------------------------------------------------------
-- Report notes
-- ---------------------------------------------------------------------------

create table public.client_report_notes (
  workspace_id uuid not null,
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  body text not null check (char_length(body) <= 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (client_id, period_start, period_end),
  -- The note always belongs to its client's workspace, so it can never point
  -- across tenants (the same composite key every data table uses).
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade,
  constraint client_report_notes_period check (period_end >= period_start and period_end - period_start < 366)
);
create index client_report_notes_workspace_idx on public.client_report_notes (workspace_id);

alter table public.client_report_notes enable row level security;

create policy client_report_notes_member_read on public.client_report_notes
  for select to authenticated using (public.is_workspace_member(workspace_id));

revoke all on public.client_report_notes from anon, authenticated;
grant select on public.client_report_notes to authenticated;

-- The note for one client and period, or null. Runs as the caller, so RLS
-- decides: another workspace's client reads as null, never as an error that
-- would confirm it exists.
create function public.client_report_note(p_client_id uuid, p_period_start date, p_period_end date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('body', n.body, 'updated_at', n.updated_at)
  from public.client_report_notes n
  where n.client_id = p_client_id and n.period_start = p_period_start and n.period_end = p_period_end;
$$;

-- Saves (or, with a blank body, clears) the note for one client and period.
-- Owner rights, so membership of the client's own workspace is checked here.
-- Returns false when the client does not exist or the caller is not a member
-- of its workspace.
create function public.save_client_report_note(p_client_id uuid, p_period_start date, p_period_end date, p_body text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start
     or p_period_end - p_period_start >= 366 or char_length(v_body) > 4000 then
    raise exception 'invalid report note' using errcode = '22023';
  end if;
  select c.workspace_id into v_workspace from public.clients c
  where c.id = p_client_id and public.is_workspace_member(c.workspace_id);
  if v_workspace is null then
    return false;
  end if;
  if v_body = '' then
    delete from public.client_report_notes n
    where n.client_id = p_client_id and n.period_start = p_period_start and n.period_end = p_period_end;
  else
    insert into public.client_report_notes as n (workspace_id, client_id, period_start, period_end, body, updated_by, updated_at)
    values (v_workspace, p_client_id, p_period_start, p_period_end, v_body, auth.uid(), now())
    on conflict (client_id, period_start, period_end) do update
      set body = excluded.body, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workspace name
-- ---------------------------------------------------------------------------

-- Owners only: the name heads every client report the workspace sends.
-- Returns false when the workspace does not exist or the caller is not its owner.
create function public.rename_workspace(p_workspace_id uuid, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid workspace name' using errcode = '22023';
  end if;
  update public.workspaces w set name = v_name
  where w.id = p_workspace_id
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = w.id and m.user_id = auth.uid() and m.role = 'owner')
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

revoke all on function public.client_report_note(uuid, date, date) from public, anon;
revoke all on function public.save_client_report_note(uuid, date, date, text) from public, anon;
revoke all on function public.rename_workspace(uuid, text) from public, anon;
grant execute on function public.client_report_note(uuid, date, date) to authenticated;
grant execute on function public.save_client_report_note(uuid, date, date, text) to authenticated;
grant execute on function public.rename_workspace(uuid, text) to authenticated;
