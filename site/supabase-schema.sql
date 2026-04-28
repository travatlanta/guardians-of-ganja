-- ============================================================
-- Guardians of Ganja — Supabase Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. PROFILES
--    Auto-created for every new auth.users signup via trigger
-- ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  phone       text default '',
  company     text default '',
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now()
);

-- Trigger: create profile row automatically when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, phone, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'company', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- 2. MESSAGE THREADS
-- ──────────────────────────────────────────────────────────
create table if not exists public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  subject         text not null default 'General Inquiry',
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- 3. MESSAGES
-- ──────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Trigger: update thread.last_message_at when a message is inserted
create or replace function public.update_thread_last_message()
returns trigger language plpgsql security definer as $$
begin
  update public.message_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_thread_last_message();

-- ──────────────────────────────────────────────────────────
-- 4. DOCUMENTS
-- ──────────────────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  type          text not null default 'other' check (type in ('quote', 'policy', 'other')),
  filename      text not null,
  storage_path  text not null,
  notes         text default '',
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- 5. EMAIL TEMPLATES
-- ──────────────────────────────────────────────────────────
create table if not exists public.email_templates (
  id            uuid primary key default gen_random_uuid(),
  trigger_type  text not null unique check (trigger_type in (
                  'signup_confirmation',
                  'new_document',
                  'new_quote',
                  'new_message_from_admin',
                  'new_message_from_customer'
                )),
  subject       text not null,
  body_html     text not null,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- Trigger: auto-update updated_at on email_templates
create or replace function public.set_template_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_template_updated on public.email_templates;
create trigger on_template_updated
  before update on public.email_templates
  for each row execute procedure public.set_template_updated_at();

-- ──────────────────────────────────────────────────────────
-- 6. DEFAULT EMAIL TEMPLATES (seed data)
-- ──────────────────────────────────────────────────────────
insert into public.email_templates (trigger_type, subject, body_html) values
(
  'signup_confirmation',
  'Welcome to Guardians of Ganja — You''re in.',
  '<h2>Welcome, {{full_name}}!</h2>
<p>Your account has been created. You can now log in to your client portal to view quotes, policies, and send messages to our team.</p>
<p><a href="https://guardians-of-ganja.vercel.app/login">Access Your Portal →</a></p>
<p>Questions? Reply to this email anytime.</p>
<p>— The Guardians of Ganja Team</p>'
),
(
  'new_document',
  'New document available in your portal',
  '<h2>Hi {{full_name}},</h2>
<p>A new <strong>{{document_type}}</strong> document has been uploaded to your client portal: <em>{{filename}}</em>.</p>
{{#notes}}<p><strong>Note from your agent:</strong> {{notes}}</p>{{/notes}}
<p><a href="https://guardians-of-ganja.vercel.app/dashboard">View in Portal →</a></p>
<p>— The Guardians of Ganja Team</p>'
),
(
  'new_quote',
  'Your insurance quote is ready',
  '<h2>Hi {{full_name}},</h2>
<p>Your insurance quote is ready for review in your client portal.</p>
<p><a href="https://guardians-of-ganja.vercel.app/dashboard">View Your Quote →</a></p>
<p>Have questions? Reply to this email or send us a message through the portal.</p>
<p>— The Guardians of Ganja Team</p>'
),
(
  'new_message_from_admin',
  'New message from Guardians of Ganja',
  '<h2>Hi {{full_name}},</h2>
<p>You have a new message from your agent regarding: <strong>{{subject}}</strong>.</p>
<p><a href="https://guardians-of-ganja.vercel.app/dashboard">Read & Reply →</a></p>
<p>— The Guardians of Ganja Team</p>'
),
(
  'new_message_from_customer',
  'New client message: {{subject}}',
  '<h2>New message from {{full_name}}</h2>
<p><strong>Client:</strong> {{full_name}} ({{email}})<br>
<strong>Subject:</strong> {{subject}}</p>
<p><strong>Preview:</strong> {{message_preview}}</p>
<p><a href="https://guardians-of-ganja.vercel.app/admin">View in Admin Panel →</a></p>'
)
on conflict (trigger_type) do nothing;

-- ──────────────────────────────────────────────────────────
-- 7. AUTO-PROMOTE KNOWN ADMIN EMAILS
--    Any of these emails will automatically receive the admin
--    role when they sign up. Add more emails as needed.
-- ──────────────────────────────────────────────────────────
create or replace function public.auto_promote_admin()
returns trigger language plpgsql security definer as $$
begin
  if lower(new.email) in ('trav.mcmichael@gmail.com') then
    new.role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_auto_promote on public.profiles;
create trigger on_profile_auto_promote
  before insert on public.profiles
  for each row execute procedure public.auto_promote_admin();

-- ──────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- PROFILES
alter table public.profiles enable row level security;

create policy "Customers read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Customers update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- MESSAGE THREADS
alter table public.message_threads enable row level security;

create policy "Customers read own threads"
  on public.message_threads for select
  using (auth.uid() = customer_id);

create policy "Customers insert own threads"
  on public.message_threads for insert
  with check (auth.uid() = customer_id);

create policy "Admins all threads"
  on public.message_threads for all
  using (public.is_admin());

-- MESSAGES
alter table public.messages enable row level security;

create policy "Customers read messages in own threads"
  on public.messages for select
  using (
    exists (
      select 1 from public.message_threads
      where id = messages.thread_id and customer_id = auth.uid()
    )
  );

create policy "Customers insert messages in own threads"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.message_threads
      where id = messages.thread_id and customer_id = auth.uid()
    )
  );

create policy "Admins all messages"
  on public.messages for all
  using (public.is_admin());

-- DOCUMENTS
alter table public.documents enable row level security;

create policy "Customers read own documents"
  on public.documents for select
  using (auth.uid() = client_id);

create policy "Admins all documents"
  on public.documents for all
  using (public.is_admin());

-- EMAIL TEMPLATES
alter table public.email_templates enable row level security;

create policy "Admins all templates"
  on public.email_templates for all
  using (public.is_admin());

-- ──────────────────────────────────────────────────────────
-- 8. STORAGE BUCKET
--    Run this after creating the 'documents' bucket in
--    Supabase Dashboard → Storage → New Bucket (private)
-- ──────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
-- on conflict do nothing;

-- Admins can upload
create policy "Admins can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents' and public.is_admin()
  );

-- Admins can delete
create policy "Admins can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents' and public.is_admin()
  );

-- Clients can download their own files (path starts with their user id)
create policy "Clients download own documents"
  on storage.objects for select
  using (
    bucket_id = 'documents' and (
      public.is_admin() or
      (auth.uid() is not null and name like (auth.uid()::text || '/%'))
    )
  );
