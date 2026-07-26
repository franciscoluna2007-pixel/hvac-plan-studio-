drop policy repair_batches_insert_editor on public.project_repair_batches;

create policy repair_batches_insert_editor
on public.project_repair_batches
for insert
to authenticated
with check (
  private.can_edit_project(project_repair_batches.project_id)
  and project_repair_batches.created_by = (select auth.uid())
  and (
    project_repair_batches.revision_id is null
    or exists (
      select 1
      from public.project_revisions as revision
      where revision.id = project_repair_batches.revision_id
        and revision.project_id = project_repair_batches.project_id
    )
  )
);
