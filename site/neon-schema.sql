-- Guardians of Ganja — Neon Postgres Schema
-- Run in your Neon SQL Editor after connecting via Vercel Marketplace.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── Subscribers (email-only signups, NOT Clerk users) ───────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT '',
  consent      BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ,
  source       TEXT NOT NULL DEFAULT 'homepage',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── User Profiles (synced from Clerk via webhook) ───────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  clerk_user_id TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  company       TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Quote Requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  company      TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Email Campaigns ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('draft', 'sent')),
  target_group TEXT NOT NULL DEFAULT 'all'
                 CHECK (target_group IN ('all', 'subscribers', 'customers', 'admins')),
  created_by   TEXT,           -- clerk_user_id of admin
  recipient_count INT NOT NULL DEFAULT 0,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Email Send Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Email Templates (for automated triggers) ───────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL UNIQUE,
  active       BOOLEAN NOT NULL DEFAULT true,
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default templates (safe to re-run)
INSERT INTO email_templates (trigger_type, active, subject, body_html) VALUES
  (
    'welcome_subscriber',
    true,
    'You''re in — Guardians of Ganja Cannabis Insurance Updates',
    '<h2 style="color:#2fb073">Welcome, {{full_name}}!</h2>
<p>Thanks for subscribing to updates from <strong>Guardians of Ganja</strong> Cannabis Insurance.</p>
<p>We''ll keep you in the loop on policy news, industry updates, and exclusive insights — no spam, ever.</p>
<p style="margin-top:1.5rem">Have questions? <a href="https://guardiansofganja.com/contact" style="color:#2fb073">Contact us anytime.</a></p>'
  ),
  (
    'signup_confirmation',
    true,
    'Welcome to Guardians of Ganja — Your Portal is Ready',
    '<h2 style="color:#2fb073">Welcome, {{full_name}}!</h2>
<p>Your client account has been created. Log in to your portal to view quotes, policies, and send messages to your agent.</p>
<p><a href="https://guardiansofganja.com/dashboard" style="color:#2fb073">Go to My Portal →</a></p>'
  ),
  (
    'new_document',
    true,
    'New document available in your portal',
    '<h2 style="color:#2fb073">Hi {{full_name}},</h2>
<p>A new <strong>{{document_type}}</strong> document (<em>{{filename}}</em>) has been uploaded to your portal.</p>
<p><a href="https://guardiansofganja.com/dashboard" style="color:#2fb073">View in My Portal →</a></p>'
  ),
  (
    'new_quote',
    true,
    'Your insurance quote is ready',
    '<h2 style="color:#2fb073">Hi {{full_name}},</h2>
<p>Your insurance quote is ready for review. Log in to your portal to view the details.</p>
<p><a href="https://guardiansofganja.com/dashboard" style="color:#2fb073">View My Quote →</a></p>'
  ),
  (
    'new_message_from_admin',
    true,
    'New message from Guardians of Ganja',
    '<h2 style="color:#2fb073">Hi {{full_name}},</h2>
<p>You have a new message regarding: <strong>{{subject}}</strong>.</p>
<p><a href="https://guardiansofganja.com/dashboard" style="color:#2fb073">Read in My Portal →</a></p>'
  ),
  (
    'new_message_from_customer',
    true,
    'New client message: {{subject}}',
    '<h2>New message from {{full_name}}</h2>
<p><strong>{{full_name}}</strong> ({{email}}) sent a message regarding: <em>{{subject}}</em>.</p>
<p><a href="https://guardiansofganja.com/admin">View in Admin Panel →</a></p>'
  )
ON CONFLICT (trigger_type) DO NOTHING;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscribers_email    ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email  ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role   ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON quote_requests(email);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_sent_at    ON email_campaigns(sent_at DESC);
