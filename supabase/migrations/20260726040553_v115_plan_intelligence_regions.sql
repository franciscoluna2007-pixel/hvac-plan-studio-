alter table public.plan_analysis_runs
  add column advanced_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(advanced_summary) = 'object');

alter table public.plan_analysis_evidence
  add column source_region jsonb
    check (source_region is null or jsonb_typeof(source_region) = 'object');

comment on column public.plan_analysis_evidence.source_region is
  'Top-left PDF.js viewport coordinates composed with the page viewport transform.';
