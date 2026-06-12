-- Compliance structure support (SCOPE.md §2):
-- 1. AMOE entries — free mail-in entries tracked by source, no order attached.
-- 2. Generic public-facing sport labels — league marks (NFL/NCAA/...) are not
--    used in customer-facing surfaces; ids stay internal.

alter table entries
  add column if not exists source text not null default 'purchase'
    check (source in ('purchase', 'amoe', 'admin'));

alter table sports
  add column if not exists short_name text;

update sports set name = 'College Football',          short_name = 'College FB'   where id = 'cfb';
update sports set name = 'Pro Football',              short_name = 'Pro FB'       where id = 'nfl';
update sports set name = 'College Basketball',        short_name = 'College BB'   where id = 'cbb';
update sports set name = 'Pro Basketball',            short_name = 'Pro BB'       where id = 'nba';
update sports set name = 'Women''s Pro Basketball',   short_name = 'Women''s BB'  where id = 'wnba';
update sports set name = 'Pro Hockey',                short_name = 'Hockey'       where id = 'nhl';
update sports set name = 'Pro Golf — Tour',           short_name = 'Golf'         where id = 'pga';
update sports set name = 'Pro Golf — League',         short_name = 'Golf League'  where id = 'liv';
update sports set name = 'Pro Baseball',              short_name = 'Baseball'     where id = 'mlb';

-- Products: discount offers are the product's value proposition
alter table products
  add column if not exists offers jsonb not null default '[]';
