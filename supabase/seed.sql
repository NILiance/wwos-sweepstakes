-- WWOS Sweepstakes — platform defaults
-- Sports + default scoring matrix from the WWOS 4 workbook (SCOPE.md Appendix A).
-- scoring_rules rows with sweepstakes_id = null are platform defaults,
-- cloned into each new sweepstakes by the setup wizard.

-- Public-facing names are generic — league marks are never customer-facing
-- (SCOPE.md §2.4). Internal ids stay conventional. Requires 0004 (short_name).
insert into sports (id, name, short_name, team_label, sort_order) values
  ('cfb',  'College Football',        'College FB',  'team',   1),
  ('nfl',  'Pro Football',            'Pro FB',      'team',   2),
  ('cbb',  'College Basketball',      'College BB',  'team',   3),
  ('nba',  'Pro Basketball',          'Pro BB',      'team',   4),
  ('wnba', 'Women''s Pro Basketball', 'Women''s BB', 'team',   5),
  ('nhl',  'Pro Hockey',              'Hockey',      'team',   6),
  ('pga',  'Pro Golf — Tour',         'Golf',        'golfer', 7),
  ('liv',  'Pro Golf — League',       'Golf League', 'golfer', 8),
  ('mlb',  'Pro Baseball',            'Baseball',    'team',   9);

-- Regular-season wins
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'cfb',  'regular', 'Regular season win', 7),
  (null, 'nfl',  'regular', 'Regular season win', 12),
  (null, 'cbb',  'regular', 'Regular season win', 3),
  (null, 'nba',  'regular', 'Regular season win', 2),
  (null, 'wnba', 'regular', 'Regular season win', 2),  -- proposed: mirror NBA (open question #5)
  (null, 'nhl',  'regular', 'Regular season win', 2),
  (null, 'pga',  'regular', 'Tournament win', 10),
  (null, 'liv',  'regular', 'Individual win', 10),
  (null, 'mlb',  'regular', 'Regular season win', 1);

-- Golf events
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'pga', 'fedex_playoff', 'FedEx playoff win (each of 2)', 15),
  (null, 'pga', 'fedex_champ',   'FedEx Champion', 25),
  (null, 'pga', 'major',         'PGA Major win (each of 4)', 25),
  (null, 'liv', 'liv_champ',     'LIV Individual Champion', 20);

-- MLB postseason
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'mlb', 'wildcard',     'Wildcard win', 3),
  (null, 'mlb', 'division',     'Division Series win', 5),
  (null, 'mlb', 'lcs',          'ALCS/NLCS win', 7),
  (null, 'mlb', 'world_series', 'World Series win', 10),
  (null, 'mlb', 'champ_bonus',  'World Series Champion bonus', 10);

-- CFB postseason
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'cfb', 'bowl',          'Non-playoff bowl win', 10),
  (null, 'cfb', 'playoff_r1',    'Playoff 1st-round win', 12),
  (null, 'cfb', 'sugar_bowl',    'Sugar Bowl win', 15),
  (null, 'cfb', 'peach_bowl',    'Peach Bowl win', 15),
  (null, 'cfb', 'fiesta_bowl',   'Fiesta Bowl win', 15),
  (null, 'cfb', 'rose_bowl',     'Rose Bowl win', 15),
  (null, 'cfb', 'cotton_bowl',   'Cotton Bowl win', 20),
  (null, 'cfb', 'orange_bowl',   'Orange Bowl win', 20),
  (null, 'cfb', 'championship',  'Championship win', 25);

-- NFL postseason
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'nfl', 'wildcard',     'Wildcard win', 7),
  (null, 'nfl', 'divisional',   'Divisional win', 12),
  (null, 'nfl', 'conf_champ',   'Conference Championship win', 15),
  (null, 'nfl', 'super_bowl',   'Super Bowl win', 25);

-- NBA playoffs (WNBA mirrors)
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'nba',  'playoff_r1',  '1st Round win', 3),
  (null, 'nba',  'playoff_r2',  '2nd Round win', 5),
  (null, 'nba',  'conf_finals', 'Conference Finals win', 7),
  (null, 'nba',  'finals',      'Finals win', 10),
  (null, 'nba',  'champ_bonus', 'Champion bonus', 10),
  (null, 'wnba', 'playoff_r1',  '1st Round win', 3),
  (null, 'wnba', 'playoff_r2',  '2nd Round win', 5),
  (null, 'wnba', 'finals',      'Finals win', 10),
  (null, 'wnba', 'champ_bonus', 'Champion bonus', 10);

-- NHL playoffs
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'nhl', 'playoff_r1',  '1st Round win', 3),
  (null, 'nhl', 'playoff_r2',  '2nd Round win', 5),
  (null, 'nhl', 'conf_finals', 'Conference Finals win', 7),
  (null, 'nhl', 'finals',      'Stanley Cup Finals win', 10),
  (null, 'nhl', 'champ_bonus', 'Stanley Cup Champion bonus', 10);

-- CBB postseason: NCAA tournament + NIT
insert into scoring_rules (sweepstakes_id, sport_id, rule_key, label, points) values
  (null, 'cbb', 'ncaa_r1',       'NCAA 1st Round win', 3),
  (null, 'cbb', 'ncaa_r2',       'NCAA 2nd Round win', 5),
  (null, 'cbb', 'ncaa_sweet16',  'NCAA Sweet 16 win', 7),
  (null, 'cbb', 'ncaa_elite8',   'NCAA Elite 8 win', 10),
  (null, 'cbb', 'ncaa_final4',   'NCAA Final 4 win', 15),
  (null, 'cbb', 'ncaa_champ',    'NCAA Champion', 25),
  (null, 'cbb', 'nit_r1',        'NIT 1st Round win', 2),
  (null, 'cbb', 'nit_r2',        'NIT 2nd Round win', 3),
  (null, 'cbb', 'nit_qf',        'NIT Quarter Final win', 4),
  (null, 'cbb', 'nit_sf',        'NIT Semi Final win', 5),
  (null, 'cbb', 'nit_champ',     'NIT Champion', 10);

-- Default WWOS roster composition (template values used by the setup wizard):
-- cfb 4 · nfl 2 · cbb 4 · nba 2 · nhl 2 · pga 3 · liv 1 · mlb 2  (20 picks)
