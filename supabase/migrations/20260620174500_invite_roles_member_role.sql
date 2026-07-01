-- Member roles and invite-issued roles for ONLYPUMP access management.
alter table public.profiles
  add column if not exists member_role text default 'user';

alter table public.profile_invite_links
  add column if not exists issued_role text default 'user';

update public.profiles
set member_role = case
  when coalesce(is_admin, false) then 'admin'
  when coalesce(is_trainer, false) then 'trainer'
  when member_role in ('admin', 'trainer', 'student', 'user') then member_role
  else 'user'
end;

update public.profiles
set
  member_role = 'trainer',
  roles = array(select distinct unnest(coalesce(roles, '{}') || array['owner', 'admin', 'trainer'])),
  is_owner = true,
  is_admin = true,
  is_trainer = true,
  access_status = 'allowed',
  access_granted_at = coalesce(access_granted_at, now()),
  deleted_at = null
where lower(coalesce(telegram_username, '')) = 'archer_ss';

update public.profile_invite_links
set issued_role = 'user'
where issued_role is null or issued_role not in ('admin', 'trainer', 'student', 'user');
