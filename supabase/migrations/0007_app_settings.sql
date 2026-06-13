-- Site-wide key/value settings (sponsor address, integration flags, etc.)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Public read (official rules render the sponsor address); admin writes
-- happen via the service role in server actions.
create policy "public read settings" on app_settings for select using (true);
