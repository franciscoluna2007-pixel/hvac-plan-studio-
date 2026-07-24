-- v104 Field Production & Takeoff Center.
-- Takeoff packages are immutable evidence records tied to a named cloud revision.

create table if not exists public.project_takeoff_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.project_revisions(id) on delete restrict,
  system_id text not null,
  name text not null,
  package_revision text not null,
  drawing_signature text not null,
  package_payload jsonb not null default '{}'::jsonb,
  drive_file_id text,
  drive_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_takeoff_package_name_length check (char_length(name) between 1 and 160),
  constraint project_takeoff_package_revision_length check (char_length(package_revision) between 1 and 40),
  constraint project_takeoff_package_signature_length check (char_length(drawing_signature) between 1 and 160),
  constraint project_takeoff_package_system_length check (char_length(system_id) between 1 and 80)
);

create index if not exists project_takeoff_packages_project_created_idx
  on public.project_takeoff_packages(project_id, created_at desc);
create index if not exists project_takeoff_packages_revision_idx
  on public.project_takeoff_packages(revision_id);

alter table public.project_takeoff_packages enable row level security;

drop policy if exists takeoff_packages_select_member on public.project_takeoff_packages;
create policy takeoff_packages_select_member
on public.project_takeoff_packages for select to authenticated
using (private.is_project_member(project_id));

drop policy if exists takeoff_packages_insert_editor on public.project_takeoff_packages;
create policy takeoff_packages_insert_editor
on public.project_takeoff_packages for insert to authenticated
with check (
  private.can_edit_project(project_id)
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.project_revisions revision
    where revision.id = revision_id
      and revision.project_id = project_id
  )
);

grant select, insert on public.project_takeoff_packages to authenticated;

comment on table public.project_takeoff_packages is
  'Immutable v104 field-production and takeoff evidence. Records saved geometry without modifying drawing objects.';
