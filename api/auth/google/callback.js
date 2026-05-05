// GET /api/auth/google/callback — Google OAuth callback handler

import { neon } from "@neondatabase/serverless";
import { signJWT, setSessionCookie } from "../../_jwt.js";
import { brandedHtml, emailBtn, emailDivider, emailMuted } from "../../_email.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "Dalton@aschemanagency.com";
const FROM_ADDR   = () => process.env.FROM_EMAIL || "noreply@guardiansofganja.com";

async function sendEmail(resendKey, to, subject, html) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Guardians of Ganja <${FROM_ADDR()}>`, to: [to], subject, html }),
  }).catch(e => console.error("[google/callback] Email failed:", e.message));
}

export default async function handler(req, res) {
  const { code, error } = req.query || {};
  const siteUrl     = process.env.SITE_URL || "https://guardiansofganja.com";
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  if (error || !code) {
    return res.redirect(302, "/login?error=google_cancelled");
  }

  // Exchange code for tokens
  let tokens;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || "token exchange failed");
  } catch (e) {
    console.error("[google/callback] token exchange error:", e.message);
    return res.redirect(302, "/login?error=google_failed");
  }

  // Get user profile from Google
  let googleUser;
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    googleUser = await profileRes.json();
    if (!googleUser.email) throw new Error("no email in profile");
  } catch (e) {
    console.error("[google/callback] profile fetch error:", e.message);
    return res.redirect(302, "/login?error=google_failed");
  }

  const sql   = neon(process.env.DATABASE_URL);
  const email = googleUser.email.toLowerCase().trim();
  const name  = googleUser.name || googleUser.email.split("@")[0];

  // Find or create user
  let user;
  let isNewUser = false;
  const existing = await sql`SELECT id, email, full_name, role FROM user_profiles WHERE email = ${email} LIMIT 1`;

  if (existing.length) {
    user = existing[0];
    if (!user.full_name && name) {
      await sql`UPDATE user_profiles SET full_name = ${name}, updated_at = now() WHERE id = ${user.id}`;
      user.full_name = name;
    }
  } else {
    const [created] = await sql`
      INSERT INTO user_profiles (email, full_name, role, password_hash)
      VALUES (${email}, ${name}, 'customer', '')
      RETURNING id, email, full_name, role
    `;
    user      = created;
    isNewUser = true;
  }

  const token = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, token);

  // Fire-and-forget emails only for brand-new accounts
  if (isNewUser) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const firstName = name.split(" ")[0];

      // Welcome email → new user
      sendEmail(resendKey, user.email, "Welcome to Guardians of Ganja", brandedHtml({
        preheader: "Your account is ready — let's get your cannabis business covered.",
        body: `
          <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Account Created</p>
          <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">Welcome, ${firstName}!<br>Your account is ready.</h1>
          <p style="margin:0 0 16px;color:#c4ddd0;">You signed in with Google and your Guardians of Ganja client portal is ready to go. Use it to submit a quote, access your documents, and message your agent directly.</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;color:#2fb073;font-size:13px;font-weight:700;">What you can do in your portal</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Submit a quote application for your operation</td></tr>
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Access your quotes, policies, and documents</td></tr>
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Message your agent directly from the inbox</td></tr>
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Track the status of your application in real time</td></tr>
              </table>
            </td></tr>
          </table>
          ${emailBtn("https://guardiansofganja.com/quote", "Start My Quote Application")}
          ${emailDivider}
          <p style="margin:0;color:#c4ddd0;font-size:14px;">Questions? Reach us at <a href="mailto:info@guardiansofganja.com" style="color:#2fb073;text-decoration:none;">info@guardiansofganja.com</a> — we typically respond within one business day.</p>
          ${emailMuted("You're receiving this because you created an account at guardiansofganja.com via Google Sign-In.")}
        `,
      }));

      // Admin notification → broker
      sendEmail(resendKey, ADMIN_EMAIL, `New Account (Google) — ${name} (${user.email})`, brandedHtml({
        preheader: `${name} just created a client account via Google Sign-In`,
        body: `
          <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">New Account</p>
          <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:22px;font-weight:800;">A new client just signed up via Google</h1>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
            <tr>
              <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Name</td>
              <td style="padding:10px 14px;color:#e8f5ee;font-size:13px;font-weight:700;border-bottom:1px solid rgba(47,176,115,0.08);">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Email</td>
              <td style="padding:10px 14px;color:#c4ddd0;font-size:13px;border-bottom:1px solid rgba(47,176,115,0.08);">${user.email}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;">Method</td>
              <td style="padding:10px 14px;color:#c4ddd0;font-size:13px;">Google Sign-In</td>
            </tr>
          </table>
          ${emailBtn("https://guardiansofganja.com/admin", "View in Admin Panel")}
          ${emailMuted("This is an automated admin notification.")}
        `,
      }));
    }
  }

  return res.redirect(302, user.role === "admin" ? "/admin" : "/dashboard");
}
