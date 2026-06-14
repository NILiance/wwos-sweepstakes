-- Allow self-registration as an entry source (commissioner productless leagues)
alter table entries drop constraint if exists entries_source_check;
alter table entries
  add constraint entries_source_check
  check (source in ('purchase', 'amoe', 'admin', 'self'));
