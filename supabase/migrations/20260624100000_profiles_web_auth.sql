alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists email text;

create unique index if not exists profiles_auth_user_id_uidx
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

create index if not exists profiles_email_lower_idx
  on public.profiles(lower(email))
  where email is not null;
