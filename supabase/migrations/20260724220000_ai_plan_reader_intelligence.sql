-- v105 AI Plan Reader + v106 Plan Intelligence
-- Stores source-linked analysis and human review decisions. No automatic drawing mutation.

create table if not exists public.plan_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid references public.project_revisions(id) on delete set null,
  source_fingerprint text not null,
  source_file_name text not null,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  page_count integer not null default 0 check (page_count >= 0),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists plan_analysis_runs_project_created_idx
  on public.plan_analysis_runs(project_id, created_at desc);
create index if not exists plan_analysis_runs_source_idx
  on public.plan_analysis_runs(project_id, source_fingerprint);

create table if not exists public.plan_analysis_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.plan_analysis_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id text not null,
  page_number integer not null check (page_number > 0),
  sheet_number text not null,
  category text not null,
  label text not null,
  value text not null,
  excerpt text not null default '',
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  source text not null default 'PDF text layer',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (run_id, client_id)
);

create index if not exists plan_analysis_evidence_run_idx
  on public.plan_analysis_evidence(run_id, category, page_number);

create table if not exists public.plan_analysis_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.plan_analysis_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  category text not null,
  title text not null,
  detail text not null,
  recommendation text not null,
  page_number integer check (page_number > 0),
  sheet_number text,
  evidence_client_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_client_ids) = 'array'),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  decision text not null default 'open' check (decision in ('open', 'accepted', 'rejected', 'ignored', 'rfi')),
  decision_note text not null default '',
  created_by uuid not null references auth.users(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, client_id)
);

create index if not exists plan_analysis_findings_run_idx
  on public.plan_analysis_findings(run_id, decision, severity);
create index if not exists plan_analysis_findings_project_idx
  on public.plan_analysis_findings(project_id, updated_at desc);

drop trigger if exists plan_analysis_findings_set_updated_at on public.plan_analysis_findings;
create trigger plan_analysis_findings_set_updated_at
before update on public.plan_analysis_findings
for each row execute function public.set_updated_at();

alter table public.plan_analysis_runs enable row level security;
alter table public.plan_analysis_evidence enable row level security;
alter table public.plan_analysis_findings enable row level security;

drop policy if exists plan_analysis_runs_select on public.plan_analysis_runs;
create policy plan_analysis_runs_select on public.plan_analysis_runs
for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists plan_analysis_runs_insert on public.plan_analysis_runs;
create policy plan_analysis_runs_insert on public.plan_analysis_runs
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.can_edit_project(project_id)
);

drop policy if exists plan_analysis_evidence_select on public.plan_analysis_evidence;
create policy plan_analysis_evidence_select on public.plan_analysis_evidence
for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists plan_analysis_evidence_insert on public.plan_analysis_evidence;
create policy plan_analysis_evidence_insert on public.plan_analysis_evidence
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.can_edit_project(project_id)
);

drop policy if exists plan_analysis_findings_select on public.plan_analysis_findings;
create policy plan_analysis_findings_select on public.plan_analysis_findings
for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists plan_analysis_findings_insert on public.plan_analysis_findings;
create policy plan_analysis_findings_insert on public.plan_analysis_findings
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.can_edit_project(project_id)
);

drop policy if exists plan_analysis_findings_update on public.plan_analysis_findings;
create policy plan_analysis_findings_update on public.plan_analysis_findings
for update to authenticated
using (private.can_edit_project(project_id))
with check (private.can_edit_project(project_id));

grant select, insert on public.plan_analysis_runs to authenticated;
grant select, insert on public.plan_analysis_evidence to authenticated;
grant select, insert, update on public.plan_analysis_findings to authenticated;
