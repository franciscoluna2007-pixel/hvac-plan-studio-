revoke all on table public.project_repair_batches from public, anon;
revoke update, delete, truncate, references, trigger
  on table public.project_repair_batches
  from authenticated;

grant select, insert on table public.project_repair_batches to authenticated;
