alter table public.project_repair_batches
  alter column reviewer_name drop default;

comment on column public.project_repair_batches.reviewer_name is
  'Required human reviewer identity; intentionally has no empty-string default.';
