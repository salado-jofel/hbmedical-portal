create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_event_type_idx
  on public.stripe_webhook_events (event_type);

create index if not exists stripe_webhook_events_object_id_idx
  on public.stripe_webhook_events (object_id);