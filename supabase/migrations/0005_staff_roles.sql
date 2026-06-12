-- Staff roles & granular backend permissions (admin > staff > user).
-- permissions: jsonb array of section keys, e.g. ["sweepstakes","products"].
-- Admins implicitly hold every permission.

alter table profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'staff', 'admin')),
  add column if not exists permissions jsonb not null default '[]';

update profiles set role = 'admin' where is_admin = true;

-- is_admin() now honors the role column (RLS policies keep working)
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin or role = 'admin' from profiles where id = auth.uid()),
    false
  )
$$;
