alter table public.project_repair_batches
  drop constraint project_repair_batches_revision_id_fkey,
  add constraint project_repair_batches_revision_id_fkey
    foreign key (revision_id)
    references public.project_revisions(id)
    on delete restrict;

alter table public.project_repair_batches
  add column client_receipt_id text,
  add column planning_override_acknowledged boolean not null default false;

update public.project_repair_batches
set client_receipt_id = 'legacy-' || id::text
where client_receipt_id is null;

alter table public.project_repair_batches
  alter column client_receipt_id set not null,
  drop constraint project_repair_batches_action_count_check,
  add constraint project_repair_batches_action_count_check
    check (action_count > 0 and action_count = jsonb_array_length(action_payload)),
  add constraint project_repair_batches_reviewer_check
    check (length(btrim(reviewer_name)) > 0),
  add constraint project_repair_batches_client_receipt_unique
    unique (project_id, client_receipt_id);

comment on column public.project_repair_batches.revision_id is
  'Immutable base revision reviewed before the repair batch was applied.';
