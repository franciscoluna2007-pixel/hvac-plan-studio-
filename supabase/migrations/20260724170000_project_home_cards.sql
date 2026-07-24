-- v101 Project Home: one RLS-safe, read-only summary per accessible project.

create or replace function public.list_project_home_cards()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  source_file_name text,
  source_drive_file_id text,
  drive_package_file_id text,
  drive_package_url text,
  drive_synced_revision_number bigint,
  drive_synced_at timestamptz,
  workflow_summary jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  latest_revision_id uuid,
  latest_revision_number bigint,
  open_work bigint,
  critical_work bigint,
  blocked_work bigint,
  pending_approvals bigint,
  changes_requested bigint,
  active_members bigint,
  file_count bigint,
  release_count bigint
)
language sql
stable
security invoker
set search_path = public, private
as $$
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.source_file_name,
    p.source_drive_file_id,
    p.drive_package_file_id,
    p.drive_package_url,
    p.drive_synced_revision_number,
    p.drive_synced_at,
    p.workflow_summary,
    p.status,
    p.created_at,
    p.updated_at,
    latest_revision.id as latest_revision_id,
    coalesce(latest_revision.revision_number, 0)::bigint as latest_revision_number,
    coalesce(work_counts.open_work, 0)::bigint as open_work,
    coalesce(work_counts.critical_work, 0)::bigint as critical_work,
    coalesce(work_counts.blocked_work, 0)::bigint as blocked_work,
    coalesce(review_counts.pending_approvals, 0)::bigint as pending_approvals,
    coalesce(review_counts.changes_requested, 0)::bigint as changes_requested,
    coalesce(member_counts.active_members, 0)::bigint as active_members,
    coalesce(file_counts.file_count, 0)::bigint as file_count,
    coalesce(release_counts.release_count, 0)::bigint as release_count
  from public.projects p
  left join lateral (
    select revision.id, revision.revision_number
    from public.project_revisions revision
    where revision.project_id = p.id
    order by revision.revision_number desc
    limit 1
  ) latest_revision on true
  left join lateral (
    select
      count(*) filter (where item.status in ('open', 'in_progress', 'blocked')) as open_work,
      count(*) filter (
        where item.priority = 'critical'
          and item.status in ('open', 'in_progress', 'blocked')
      ) as critical_work,
      count(*) filter (where item.status = 'blocked') as blocked_work
    from public.project_work_items item
    where item.project_id = p.id
  ) work_counts on true
  left join lateral (
    select
      count(*) filter (where approval.status = 'requested') as pending_approvals,
      count(*) filter (where approval.status = 'changes_requested') as changes_requested
    from public.project_approvals approval
    where approval.project_id = p.id
      and approval.revision_id = latest_revision.id
  ) review_counts on true
  left join lateral (
    select count(*) as active_members
    from public.project_members member
    where member.project_id = p.id and member.status = 'active'
  ) member_counts on true
  left join lateral (
    select count(*) as file_count
    from public.project_files project_file
    where project_file.project_id = p.id and project_file.status = 'active'
  ) file_counts on true
  left join lateral (
    select count(*) as release_count
    from public.project_field_releases field_release
    where field_release.project_id = p.id
  ) release_counts on true
  where p.status = 'active'
    and private.is_project_member(p.id)
  order by p.updated_at desc;
$$;

revoke all on function public.list_project_home_cards() from public;
revoke all on function public.list_project_home_cards() from anon;
grant execute on function public.list_project_home_cards() to authenticated;

comment on function public.list_project_home_cards() is
  'Returns RLS-filtered Project Home summaries without exposing or modifying drawing geometry.';
