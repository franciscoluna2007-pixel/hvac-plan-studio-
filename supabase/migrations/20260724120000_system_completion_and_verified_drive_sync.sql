alter table public.projects
  add column if not exists workflow_summary jsonb not null default '{}'::jsonb,
  add column if not exists drive_synced_revision_number bigint not null default 0
    check (drive_synced_revision_number >= 0),
  add column if not exists drive_synced_at timestamptz;

comment on column public.projects.workflow_summary is
  'Derived, review-only project completion state saved with the latest named revision.';
comment on column public.projects.drive_synced_revision_number is
  'The immutable cloud revision contained in the current Google Drive package. Zero means legacy or unverified.';

create or replace function public.record_drive_package_sync(
  project_uuid uuid,
  package_file_id text,
  package_file_url text,
  synced_revision bigint
)
returns public.projects
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_project public.projects;
begin
  if auth.uid() is null or not private.can_edit_project(project_uuid) then
    raise exception 'You do not have permission to sync this project';
  end if;

  if nullif(trim(package_file_id), '') is null or synced_revision < 1 then
    raise exception 'A valid Drive file and cloud revision are required';
  end if;

  if not exists (
    select 1
    from public.project_revisions
    where project_id = project_uuid
      and revision_number = synced_revision
  ) then
    raise exception 'The selected cloud revision does not exist';
  end if;

  update public.projects
  set drive_package_file_id = package_file_id,
      drive_package_url = nullif(trim(package_file_url), ''),
      drive_synced_revision_number = synced_revision,
      drive_synced_at = now()
  where id = project_uuid
  returning * into updated_project;

  if updated_project.id is null then
    raise exception 'Project not found';
  end if;

  insert into public.project_activity(project_id, actor_id, action, details)
  values (
    project_uuid,
    auth.uid(),
    'drive_package_synced',
    jsonb_build_object(
      'revision', synced_revision,
      'drive_file_id', package_file_id
    )
  );

  return updated_project;
end;
$$;

grant execute on function public.record_drive_package_sync(uuid, text, text, bigint)
  to authenticated;
revoke execute on function public.record_drive_package_sync(uuid, text, text, bigint)
  from public, anon;
