create table if not exists public.workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  render_quality text not null default 'auto'
    check (render_quality in ('auto', 'performance', 'sharp', '4k')),
  ui_density text not null default 'comfortable'
    check (ui_density in ('comfortable', 'compact')),
  left_panel_open boolean not null default true,
  right_panel_open boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.workspace_preferences is
  'Per-user, cross-device workspace display preferences. Never stores project geometry.';

alter table public.workspace_preferences enable row level security;

drop policy if exists "workspace_preferences_select_own" on public.workspace_preferences;
create policy "workspace_preferences_select_own"
  on public.workspace_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "workspace_preferences_insert_own" on public.workspace_preferences;
create policy "workspace_preferences_insert_own"
  on public.workspace_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "workspace_preferences_update_own" on public.workspace_preferences;
create policy "workspace_preferences_update_own"
  on public.workspace_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "workspace_preferences_delete_own" on public.workspace_preferences;
create policy "workspace_preferences_delete_own"
  on public.workspace_preferences
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.workspace_preferences from anon;
grant select, insert, update, delete on public.workspace_preferences to authenticated;
