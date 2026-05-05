-- Seed branded email templates into the email_templates table.
-- Run this in the Neon SQL editor.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO UPDATE.

-- ─────────────────────────────────────────────────────────────────
-- Welcome Subscriber
-- Triggered by: api/subscribe.js when a visitor signs up for updates
-- Variables: {{full_name}}, {{email}}
-- ─────────────────────────────────────────────────────────────────
INSERT INTO email_templates (trigger_type, subject, body_html, active)
VALUES (
  'welcome_subscriber',
  'Welcome to Guardians of Ganja',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @media only screen and (max-width:600px){
      .email-body{padding:28px 24px!important}
      .email-header{padding:28px 24px!important}
      .email-footer{padding:20px 24px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#111e17;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#111e17;">Welcome to Guardians of Ganja &mdash; cannabis insurance built for your operation.&#8204;&#8204;&#8204;&#8204;</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111e17;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;border:1px solid rgba(47,176,115,0.2);">
        <tr>
          <td class="email-header" style="background:#0a1510;padding:36px 48px 28px;text-align:center;border-bottom:1px solid rgba(47,176,115,0.15);">
            <img src="https://guardiansofganja.com/assets/img/logo-full.png" alt="Guardians of Ganja" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;border:0;" />
            <div style="height:2px;background:linear-gradient(90deg,transparent,#2fb073,transparent);margin-top:22px;border-radius:2px;"></div>
          </td>
        </tr>
        <tr>
          <td class="email-body" style="background:#0e1c14;padding:40px 48px;">
            <div style="color:#d4e8dc;font-size:15px;line-height:1.75;">
              <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">You''re In</p>
              <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">Welcome, {{full_name}}!</h1>
              <p style="margin:0 0 16px;color:#c4ddd0;">Thanks for subscribing to updates from Guardians of Ganja. You''ll be the first to know about new coverage options, industry news, and resources built specifically for cannabis businesses like yours.</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:#2fb073;font-size:13px;font-weight:700;">What we cover</p>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; General &amp; Product Liability</td></tr>
                    <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Commercial Property &amp; Crop Insurance</td></tr>
                    <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Commercial Auto &amp; Work Comp</td></tr>
                    <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Cultivation, Manufacturing &amp; Distribution</td></tr>
                  </table>
                </td></tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px;">
                <tr>
                  <td align="center" style="background:#2fb073;border-radius:10px;">
                    <a href="https://guardiansofganja.com/quote" style="display:inline-block;padding:14px 36px;background:#2fb073;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.02em;border-radius:10px;">Get a Free Quote &rarr;</a>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background:rgba(47,176,115,0.15);margin:28px 0;"></div>
              <p style="color:#4a7a5a;font-size:12px;line-height:1.6;margin:0;">You''re receiving this because you signed up at guardiansofganja.com. If this was a mistake, simply disregard this email.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td class="email-footer" style="background:#081008;padding:24px 48px;text-align:center;border-top:1px solid rgba(47,176,115,0.1);">
            <p style="margin:0 0 6px;color:#4a7a5a;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Guardians of Ganja</p>
            <p style="margin:0 0 10px;color:#3a5a45;font-size:12px;">Cannabis Insurance Solutions</p>
            <p style="margin:0 0 14px;">
              <a href="https://guardiansofganja.com" style="color:#2fb073;text-decoration:none;font-size:12px;">guardiansofganja.com</a>
              <span style="color:#2a4a35;font-size:12px;">&nbsp;&middot;&nbsp;</span>
              <a href="mailto:info@guardiansofganja.com" style="color:#3a6a4a;text-decoration:none;font-size:12px;">info@guardiansofganja.com</a>
            </p>
            <p style="margin:0;color:#2a4030;font-size:11px;">&copy; 2026 Guardians of Ganja. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  true
)
ON CONFLICT (trigger_type) DO UPDATE
  SET subject   = EXCLUDED.subject,
      body_html = EXCLUDED.body_html,
      active    = EXCLUDED.active,
      updated_at = now();
