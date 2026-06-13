-- League members (registrants) contact info + commissioner messaging
alter table entries add column if not exists email text;
alter table entries add column if not exists phone text;

comment on column entries.email is 'Registrant email — commissioners message members here (off-platform leagues).';
comment on column entries.phone is 'Optional registrant phone for commissioner records.';

create table if not exists league_messages (
  id uuid primary key default gen_random_uuid(),
  sweepstakes_id uuid not null references sweepstakes(id) on delete cascade,
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  sent_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists league_messages_sweepstakes_idx
  on league_messages(sweepstakes_id, created_at desc);

alter table league_messages enable row level security;

drop policy if exists league_messages_owner_read on league_messages;
create policy league_messages_owner_read on league_messages
  for select using (
    is_admin()
    or exists (
      select 1 from sweepstakes s
      where s.id = league_messages.sweepstakes_id
        and s.created_by = auth.uid()
    )
  );
