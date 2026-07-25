-- HVAC Plan Studio v107: owner analytics and subscription-ready account access.
-- Public visitors may test the local workspace. Durable cloud value remains account-based.

create table if not exists public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_role text not null default 'member'
    check (app_role in ('owner', 'admin', 'member')),
  plan_code text not null default 'free'
    check (plan_code in ('free', 'professional', 'team')),
  subscription_status text not null default 'none'
    check (subscription_status in (
      'none',
      'early_access',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  event_id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_name text not null check (event_name in (
    'workspace_opened',
    'pdf_opened',
    'ai_analysis_started',
    'ai_analysis_completed',
    'ai_analysis_failed',
    'finding_decided',
    'markup_created',
    'takeoff_exported',
    'takeoff_package_saved',
    'cloud_project_saved',
    'cloud_revision_saved',
    'drive_imported',
    'drive_package_saved',
    'revision_opened',
    'upgrade_viewed',
    'early_access_requested',
    'application_error'
  )),
  page_path text not null default '/' check (char_length(page_path) <= 200),
  app_version text not null default '107' check (char_length(app_version) <= 16),
  properties jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(properties) = 'object'
      and octet_length(properties::text) <= 2048
      and not properties ?| array[
        'address',
        'customer',
        'email',
        'excerpt',
        'file',
        'filename',
        'name',
        'pdf',
        'plan_text',
        'source'
      ]
    ),
  created_at timestamptz not null default now()
);

create table if not exists public.professional_early_access (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  source text not null default 'project_home' check (char_length(source) <= 40),
  requested_at timestamptz not null default now()
);

create table if not exists private.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text unique,
  provider_subscription_id text unique,
  provider_price_id text,
  plan_code text not null default 'free'
    check (plan_code in ('free', 'professional', 'team')),
  status text not null default 'none'
    check (status in (
      'none',
      'early_access',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists private.billing_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists usage_events_created_idx
  on public.usage_events(created_at desc);
create index if not exists usage_events_name_created_idx
  on public.usage_events(event_name, created_at desc);
create index if not exists usage_events_visitor_created_idx
  on public.usage_events(visitor_id, created_at desc);
create index if not exists usage_events_user_created_idx
  on public.usage_events(user_id, created_at desc)
  where user_id is not null;

create or replace function public.analytics_properties_safe(input jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(input) = 'object'
    and octet_length(input::text) <= 2048
    and not exists (
      select 1
      from jsonb_each(input) as entry(key, value)
      where entry.key not in (
        'action',
        'area',
        'decision',
        'duration_ms',
        'export_type',
        'finding_count',
        'format',
        'item_count',
        'kind',
        'origin',
        'page_count',
        'revision',
        'row_count',
        'severity',
        'takeoff_rows',
        'tier'
      )
      or jsonb_typeof(entry.value) not in ('string', 'number', 'boolean')
      or (
        jsonb_typeof(entry.value) = 'string'
        and char_length(entry.value #>> '{}') > 80
      )
    )
    and (
      not input ? 'page_count'
      or (
        jsonb_typeof(input -> 'page_count') = 'number'
        and input ->> 'page_count' ~ '^[0-9]{1,6}$'
        and (input ->> 'page_count')::integer between 0 and 100000
      )
    );
$$;

alter table public.usage_events
  drop constraint if exists usage_events_properties_safe;
alter table public.usage_events
  add constraint usage_events_properties_safe
  check (public.analytics_properties_safe(properties));

insert into public.account_access(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_account_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_access(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_account_access on auth.users;
create trigger on_auth_user_account_access
after insert on auth.users
for each row execute function public.handle_new_account_access();

drop trigger if exists account_access_set_updated_at on public.account_access;
create trigger account_access_set_updated_at
before update on public.account_access
for each row execute function public.set_updated_at();

alter table public.account_access enable row level security;
alter table public.usage_events enable row level security;
alter table public.professional_early_access enable row level security;
alter table private.billing_subscriptions enable row level security;
alter table private.billing_webhook_events enable row level security;

drop policy if exists account_access_select_own on public.account_access;
create policy account_access_select_own
on public.account_access for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists usage_events_insert_guest on public.usage_events;
create policy usage_events_insert_guest
on public.usage_events for insert to anon
with check (user_id is null);

drop policy if exists usage_events_insert_account on public.usage_events;
create policy usage_events_insert_account
on public.usage_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists professional_early_access_insert_own on public.professional_early_access;
create policy professional_early_access_insert_own
on public.professional_early_access for insert to authenticated
with check (user_id = (select auth.uid()));

-- Profiles contain presentation data only. Authority and subscription state remain server-managed.
drop policy if exists profiles_insert_own on public.profiles;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, avatar_url) on public.profiles to authenticated;

revoke all on public.account_access from public, anon, authenticated;
grant select on public.account_access to authenticated;
grant select, insert, update, delete on public.account_access to service_role;

revoke all on public.usage_events from public, anon, authenticated;
grant insert(visitor_id, session_id, event_name, page_path, app_version, properties)
  on public.usage_events to anon, authenticated;
grant select, insert, update, delete on public.usage_events to service_role;

revoke all on public.professional_early_access from public, anon, authenticated;
grant insert(source) on public.professional_early_access to authenticated;
grant select, insert, update, delete on public.professional_early_access to service_role;

revoke all on private.billing_subscriptions from public, anon, authenticated;
revoke all on private.billing_webhook_events from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.billing_subscriptions to service_role;
grant select, insert, update, delete on private.billing_webhook_events to service_role;

create or replace function public.get_account_context()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'display_name', p.display_name,
    'platform_role', a.app_role,
    'plan_tier', a.plan_code,
    'subscription_status', a.subscription_status
  )
  from public.profiles p
  join public.account_access a on a.user_id = p.id
  where p.id = (select auth.uid());
$$;

create or replace function public.get_current_account_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  account_role text;
  configured_plan text;
  account_status text;
  effective_plan text;
  period_start timestamptz := date_trunc('month', now());
  ai_pages bigint;
  takeoff_exports bigint;
  cloud_projects bigint;
begin
  if account_id is null then
    raise insufficient_privilege using message = 'Sign in to view account usage';
  end if;

  select app_role, plan_code, subscription_status
  into account_role, configured_plan, account_status
  from public.account_access
  where user_id = account_id;

  effective_plan := case
    when account_role in ('owner', 'admin') then 'team'
    when account_status in ('early_access', 'trialing', 'active')
      and configured_plan in ('professional', 'team')
      then configured_plan
    else 'free'
  end;

  select coalesce(sum(
    case
      when jsonb_typeof(properties -> 'page_count') = 'number'
        then (properties ->> 'page_count')::bigint
      else 0
    end
  ), 0)
  into ai_pages
  from public.usage_events
  where user_id = account_id
    and event_name = 'ai_analysis_completed'
    and created_at >= period_start;

  select count(*) into takeoff_exports
  from public.usage_events
  where user_id = account_id
    and event_name = 'takeoff_exported'
    and created_at >= period_start;

  select count(*) into cloud_projects
  from public.projects
  where owner_id = account_id
    and status = 'active';

  return jsonb_build_object(
    'tier', coalesce(effective_plan, 'free'),
    'period_start', period_start,
    'ai_pages_used', ai_pages,
    'ai_pages_limit', case coalesce(effective_plan, 'free') when 'team' then 5000 when 'professional' then 1500 else 100 end,
    'takeoff_exports_used', takeoff_exports,
    'takeoff_exports_limit', case coalesce(effective_plan, 'free') when 'team' then 2147483647 when 'professional' then 2147483647 else 1 end,
    'cloud_projects_used', cloud_projects,
    'cloud_projects_limit', case coalesce(effective_plan, 'free') when 'team' then 2147483647 when 'professional' then 25 else 2 end
  );
end;
$$;

create or replace function public.get_owner_analytics(window_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  report_days integer := greatest(1, least(coalesce(window_days, 30), 365));
  cutoff timestamptz;
  result jsonb;
begin
  if account_id is null or not exists (
    select 1
    from public.account_access
    where user_id = account_id
      and app_role in ('owner', 'admin')
  ) then
    raise insufficient_privilege using message = 'Owner analytics access required';
  end if;

  cutoff := now() - make_interval(days => report_days);

  with
  customer_events as (
    select usage_event.*
    from public.usage_events usage_event
    where not exists (
      select 1
      from public.account_access access
      where access.user_id = usage_event.user_id
        and access.app_role in ('owner', 'admin')
    )
  ),
  window_events as (
    select *
    from customer_events
    where created_at >= cutoff
  ),
  returning_visitors_in_window as (
    select distinct current_event.visitor_id
    from window_events current_event
    where exists (
      select 1
      from customer_events earlier_event
      where earlier_event.visitor_id = current_event.visitor_id
        and earlier_event.created_at < cutoff
    )
  ),
  activated as (
    select visitor_id
    from window_events
    group by visitor_id
    having count(*) filter (where event_name = 'pdf_opened') > 0
       and count(*) filter (where event_name = 'ai_analysis_completed') > 0
       and count(*) filter (where event_name = 'finding_decided') > 0
  ),
  event_totals as (
    select event_name, count(*)::bigint as event_count
    from window_events
    group by event_name
    order by event_count desc, event_name
    limit 12
  ),
  base as (
    select
      (select count(distinct visitor_id) from window_events)::bigint as unique_visitors,
      (select count(distinct session_id) from window_events)::bigint as visits,
      (select count(*) from returning_visitors_in_window)::bigint as returning_visitors,
      (select count(*) from auth.users where email is not null)::bigint as registered_accounts,
      (select count(*) from auth.users where email is not null and created_at >= cutoff)::bigint as new_accounts,
      (select count(*) from activated)::bigint as activated_visitors,
      (select count(*) from window_events where event_name = 'pdf_opened')::bigint as pdfs_opened,
      (select count(*) from window_events where event_name = 'ai_analysis_completed')::bigint as ai_analyses,
      (select count(*) from window_events where event_name = 'finding_decided')::bigint as findings_decided,
      (select count(*) from window_events where event_name = 'takeoff_exported')::bigint as takeoffs_exported,
      (select count(distinct visitor_id) from customer_events where created_at >= now() - interval '1 day')::bigint as daily_active,
      (select count(distinct visitor_id) from customer_events where created_at >= now() - interval '7 days')::bigint as weekly_active,
      (select count(distinct visitor_id) from customer_events where created_at >= now() - interval '30 days')::bigint as monthly_active,
      (select count(*) from public.projects where status = 'active' and updated_at >= cutoff)::bigint as active_cloud_projects,
      (select coalesce(sum(
        case
          when event_name = 'ai_analysis_completed'
            and jsonb_typeof(properties -> 'page_count') = 'number'
            then (properties ->> 'page_count')::bigint
          else 0
        end
      ), 0) from window_events)::bigint as ai_pages_read,
      (select count(*) from window_events where event_name = 'drive_imported')::bigint as drive_imports,
      (select count(*) from window_events where event_name = 'upgrade_viewed')::bigint as upgrade_views,
      (select count(*) from public.professional_early_access where requested_at >= cutoff)::bigint as early_access_requests,
      (select count(*) from public.account_access where plan_code = 'free')::bigint as free_accounts,
      (select count(*) from public.account_access where plan_code = 'professional')::bigint as professional_accounts,
      (select count(*) from public.account_access where plan_code = 'team')::bigint as team_accounts,
      (select count(*) from window_events where event_name = 'ai_analysis_completed')::bigint as completed_analyses,
      (select count(*) from window_events where event_name = 'ai_analysis_failed')::bigint as failed_analyses,
      (select count(*) from window_events where event_name = 'application_error')::bigint as application_errors
  )
  select jsonb_build_object(
    'windowDays', report_days,
    'generatedAt', now(),
    'audience', jsonb_build_object(
      'uniqueVisitors', unique_visitors,
      'visits', visits,
      'returningVisitors', returning_visitors,
      'registeredAccounts', registered_accounts,
      'newAccounts', new_accounts,
      'signupConversionPercent', case when unique_visitors = 0 then 0 else round(new_accounts::numeric * 100 / unique_visitors, 1) end
    ),
    'activation', jsonb_build_object(
      'pdfsOpened', pdfs_opened,
      'aiAnalyses', ai_analyses,
      'findingsDecided', findings_decided,
      'takeoffsExported', takeoffs_exported,
      'activatedVisitors', activated_visitors
    ),
    'engagement', jsonb_build_object(
      'dailyActive', daily_active,
      'weeklyActive', weekly_active,
      'monthlyActive', monthly_active,
      'activeCloudProjects', active_cloud_projects,
      'aiPagesRead', ai_pages_read,
      'driveImports', drive_imports
    ),
    'growth', jsonb_build_object(
      'upgradeViews', upgrade_views,
      'earlyAccessRequests', early_access_requests,
      'freeAccounts', free_accounts,
      'professionalAccounts', professional_accounts,
      'teamAccounts', team_accounts
    ),
    'reliability', jsonb_build_object(
      'completedAnalyses', completed_analyses,
      'failedAnalyses', failed_analyses,
      'analysisSuccessPercent', case
        when completed_analyses + failed_analyses = 0 then 100
        else round(completed_analyses::numeric * 100 / (completed_analyses + failed_analyses), 1)
      end,
      'applicationErrors', application_errors
    ),
    'topEvents', coalesce((
      select jsonb_agg(jsonb_build_object('event', event_name, 'count', event_count))
      from event_totals
    ), '[]'::jsonb)
  )
  into result
  from base;

  return result;
end;
$$;

revoke all on function public.handle_new_account_access() from public, anon, authenticated;
revoke all on function public.analytics_properties_safe(jsonb) from public;
grant execute on function public.analytics_properties_safe(jsonb) to anon, authenticated, service_role;
revoke all on function public.get_account_context() from public, anon;
grant execute on function public.get_account_context() to authenticated;
revoke all on function public.get_current_account_usage() from public, anon;
grant execute on function public.get_current_account_usage() to authenticated;
revoke all on function public.get_owner_analytics(integer) from public, anon;
grant execute on function public.get_owner_analytics(integer) to authenticated;
