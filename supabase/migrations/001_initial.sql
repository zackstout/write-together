-- ============================================================
-- Write Together — Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── Prompts ──────────────────────────────────────────────────
create table public.prompts (
  id               uuid primary key default gen_random_uuid(),
  text             text not null,
  max_response_chars int not null default 2000,
  created_at       timestamptz not null default now()
);

alter table public.prompts enable row level security;

create policy "Prompts are publicly readable"
  on public.prompts for select
  using (true);

-- ── Periods ──────────────────────────────────────────────────
create table public.periods (
  id          uuid primary key default gen_random_uuid(),
  prompt_id   uuid not null references public.prompts(id),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Only one active period at a time
create unique index one_active_period
  on public.periods (( ended_at is null ))
  where ended_at is null;

alter table public.periods enable row level security;

create policy "Periods are publicly readable"
  on public.periods for select
  using (true);

-- ── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Invitations ───────────────────────────────────────────────
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  invited_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invitations enable row level security;

create policy "Logged-in users can view invitations"
  on public.invitations for select
  using (auth.uid() is not null);

create policy "Logged-in users can create invitations"
  on public.invitations for insert
  with check (auth.uid() is not null);

-- Mark invitation as accepted when the invited user first logs in
create or replace function public.handle_invitation_accepted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.invitations
  set accepted_at = now()
  where email = new.email and accepted_at is null;
  return new;
end;
$$;

create trigger on_auth_user_created_accept_invitation
  after insert on auth.users
  for each row execute procedure public.handle_invitation_accepted();

-- ── Responses ─────────────────────────────────────────────────
create table public.responses (
  id           uuid primary key default gen_random_uuid(),
  period_id    uuid not null references public.periods(id),
  user_id      uuid not null references public.profiles(id),
  content      text not null default '',
  is_draft     boolean not null default true,
  is_public    boolean not null default true,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(period_id, user_id)
);

alter table public.responses enable row level security;

-- Public submitted responses are readable by anyone
create policy "Public responses are readable by anyone"
  on public.responses for select
  using (is_public = true and is_draft = false);

-- Owners can read their own responses (including drafts and private)
create policy "Owners can read their own responses"
  on public.responses for select
  using (auth.uid() = user_id);

-- Owners can insert their own responses
create policy "Owners can insert their own response"
  on public.responses for insert
  with check (auth.uid() = user_id);

-- Owners can update only while still a draft
create policy "Owners can update drafts"
  on public.responses for update
  using (auth.uid() = user_id and is_draft = true);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger responses_updated_at
  before update on public.responses
  for each row execute procedure public.handle_updated_at();

-- ── Comments ──────────────────────────────────────────────────
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.comments enable row level security;

-- Comments on public responses are readable by anyone
create policy "Comments on public responses are readable by anyone"
  on public.comments for select
  using (
    exists (
      select 1 from public.responses r
      where r.id = response_id
        and r.is_public = true
        and r.is_draft = false
    )
  );

-- Logged-in users can post comments on public submitted responses
create policy "Logged-in users can post comments"
  on public.comments for insert
  with check (
    auth.uid() is not null and
    exists (
      select 1 from public.responses r
      where r.id = response_id
        and r.is_public = true
        and r.is_draft = false
    )
  );
