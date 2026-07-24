-- HVAC Plan Studio v100.1 — verified cloud field releases.
-- A field release is recorded only when the working-copy fingerprint matches
-- the latest named revision and that revision has a clean approval state.

begin;

alter table public.project_revisions
  add column if not exists release_fingerprint text;

update public.project_revisions
set release_fingerprint = nullif(snapshot ->> 'cloudReleaseFingerprint', '')
where release_fingerprint is null;

create table if not exists public.project_field_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid not null,
  system_id text not null check (char_length(trim(system_id)) between 1 and 80),
  release_revision text not null check (char_length(trim(release_revision)) between 1 and 80),
  released_by_name text not null check (char_length(trim(released_by_name)) between 1 and 160),
  drawing_signature text not null check (char_length(trim(drawing_signature)) between 1 and 160),
  release_signature text not null check (char_length(trim(release_signature)) between 1 and 160),
  release_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(release_payload) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(project_id, revision_id)
    references public.project_revisions(project_id, id)
    on delete restrict
);

create unique index if not exists project_field_releases_named_revision_idx
  on public.project_field_releases(project_id, system_id, lower(release_revision));
create index if not exists project_field_releases_project_idx
  on public.project_field_releases(project_id, created_at desc);

alter table public.project_field_releases enable row level security;

drop policy if exists field_releases_select_member on public.project_field_releases;
create policy field_releases_select_member
on public.project_field_releases for select to authenticated
using (private.is_project_member(project_id));

grant select on public.project_field_releases to authenticated;
revoke insert, update, delete on public.project_field_releases from authenticated;

create or replace function public.save_project_revision(
  project_uuid uuid,
  revision_title text,
  revision_summary text,
  revision_snapshot jsonb,
  revision_drawing_count integer
)
returns public.project_revisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_revision bigint;
  created_revision public.project_revisions;
  next_workflow_summary jsonb;
  next_release_fingerprint text;
begin
  if auth.uid() is null or not private.can_edit_project(project_uuid) then
    raise exception 'You do not have permission to save this project';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(project_uuid::text, 0));
  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.project_revisions
  where project_id = project_uuid;

  next_workflow_summary := coalesce(revision_snapshot -> 'workflowSummary', '{}'::jsonb);
  next_release_fingerprint := nullif(trim(revision_snapshot ->> 'cloudReleaseFingerprint'), '');
  if next_release_fingerprint is null then
    raise exception 'A release fingerprint is required for a named revision';
  end if;

  insert into public.project_revisions(
    project_id,
    revision_number,
    created_by,
    title,
    summary,
    snapshot,
    drawing_count,
    workflow_summary,
    content_hash,
    release_fingerprint
  )
  values (
    project_uuid,
    next_revision,
    auth.uid(),
    coalesce(nullif(trim(revision_title), ''), 'Revision ' || next_revision),
    coalesce(trim(revision_summary), ''),
    revision_snapshot,
    greatest(coalesce(revision_drawing_count, 0), 0),
    next_workflow_summary,
    encode(extensions.digest(revision_snapshot::text, 'sha256'), 'hex'),
    next_release_fingerprint
  )
  returning * into created_revision;

  update public.projects
  set workflow_summary = next_workflow_summary,
      updated_at = now()
  where id = project_uuid;

  return created_revision;
end;
$$;

create or replace function public.issue_project_field_release(
  project_uuid uuid,
  cloud_revision_uuid uuid,
  expected_release_fingerprint text,
  system_identifier text,
  release_revision_name text,
  released_by_label text,
  drawing_signature_value text,
  release_signature_value text,
  release_payload_value jsonb
)
returns public.project_field_releases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  latest_revision public.project_revisions;
  created_release public.project_field_releases;
begin
  if auth.uid() is null or not private.can_edit_project(project_uuid) then
    raise exception 'You do not have permission to issue this project';
  end if;

  if nullif(trim(system_identifier), '') is null
    or nullif(trim(release_revision_name), '') is null
    or nullif(trim(released_by_label), '') is null
    or nullif(trim(drawing_signature_value), '') is null
    or nullif(trim(release_signature_value), '') is null
    or nullif(trim(expected_release_fingerprint), '') is null then
    raise exception 'Complete release identity and signatures are required';
  end if;

  if release_payload_value is null or jsonb_typeof(release_payload_value) <> 'object' then
    raise exception 'A valid release record is required';
  end if;

  -- These locks make the review check and release record one consistent
  -- decision. Coordination writes resume immediately after this transaction.
  lock table public.project_revisions in share mode;
  lock table public.project_work_items in share mode;
  lock table public.project_approvals in share mode;

  select *
  into latest_revision
  from public.project_revisions
  where project_id = project_uuid
  order by revision_number desc
  limit 1;

  if latest_revision.id is null then
    raise exception 'Save a named cloud revision before field release';
  end if;
  if latest_revision.id <> cloud_revision_uuid then
    raise exception 'Open the latest cloud revision before field release';
  end if;
  if latest_revision.release_fingerprint is null
    or latest_revision.release_fingerprint <> expected_release_fingerprint then
    raise exception 'The working drawing changed; save a new named revision';
  end if;

  if exists (
    select 1
    from public.project_work_items work
    where work.project_id = project_uuid
      and work.priority = 'critical'
      and work.status not in ('resolved', 'closed')
  ) then
    raise exception 'Critical project work must be resolved before field release';
  end if;

  if exists (
    select 1
    from public.project_approvals approval
    where approval.project_id = project_uuid
      and approval.revision_id = latest_revision.id
      and approval.status in ('requested', 'changes_requested')
  ) then
    raise exception 'The latest revision still has an open or rejected review';
  end if;

  if not exists (
    select 1
    from public.project_approvals approval
    where approval.project_id = project_uuid
      and approval.revision_id = latest_revision.id
      and approval.status = 'approved'
  ) then
    raise exception 'The latest revision needs an approval before field release';
  end if;

  insert into public.project_field_releases(
    project_id,
    revision_id,
    system_id,
    release_revision,
    released_by_name,
    drawing_signature,
    release_signature,
    release_payload,
    created_by
  )
  values (
    project_uuid,
    latest_revision.id,
    trim(system_identifier),
    trim(release_revision_name),
    trim(released_by_label),
    trim(drawing_signature_value),
    trim(release_signature_value),
    release_payload_value,
    auth.uid()
  )
  returning * into created_release;

  insert into public.project_activity(project_id, actor_id, action, details)
  values (
    project_uuid,
    auth.uid(),
    'field_release_issued',
    jsonb_build_object(
      'field_release_id', created_release.id,
      'revision_id', latest_revision.id,
      'revision_number', latest_revision.revision_number,
      'system_id', created_release.system_id,
      'release_revision', created_release.release_revision
    )
  );

  update public.projects set updated_at = now() where id = project_uuid;
  return created_release;
end;
$$;

grant execute on function public.issue_project_field_release(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

revoke execute on function public.issue_project_field_release(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon;

commit;
