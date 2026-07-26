create table public.project_repair_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid references public.project_revisions(id) on delete set null,
  system_id text not null,
  assistant_version text not null,
  repair_plan_id text not null,
  evidence_fingerprint text not null,
  before_fingerprint text not null,
  after_fingerprint text not null,
  autonomy_mode text not null
    check (autonomy_mode in ('inspect', 'prepare', 'guided')),
  action_count integer not null
    check (action_count > 0),
  action_payload jsonb not null
    check (jsonb_typeof(action_payload) = 'array'),
  takeoff_delta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(takeoff_delta) = 'object'),
  reviewer_name text not null default '',
  note text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.project_repair_batches is
  'Append-only audit receipts for evidence-bound HVAC assistant repair batches.';

create index project_repair_batches_project_created_idx
  on public.project_repair_batches(project_id, created_at desc);

create index project_repair_batches_revision_idx
  on public.project_repair_batches(revision_id)
  where revision_id is not null;

create index project_repair_batches_evidence_idx
  on public.project_repair_batches(project_id, evidence_fingerprint);

alter table public.project_repair_batches enable row level security;

create policy repair_batches_select_member
on public.project_repair_batches
for select
to authenticated
using (private.is_project_member(project_id));

create policy repair_batches_insert_editor
on public.project_repair_batches
for insert
to authenticated
with check (
  private.can_edit_project(project_id)
  and created_by = (select auth.uid())
  and (
    revision_id is null
    or exists (
      select 1
      from public.project_revisions as revision
      where revision.id = project_repair_batches.revision_id
        and revision.project_id = project_repair_batches.project_id
    )
  )
);

grant select, insert on public.project_repair_batches to authenticated;
