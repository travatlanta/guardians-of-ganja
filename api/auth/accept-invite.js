// POST /api/auth/accept-invite
// Body: { token, full_name, password }
// Validates invite token, creates user account, marks invite used, sets session cookie.

import { neon }   from "@neondatabase/serverless";
import bcrypt     from "bcryptjs";
import { signJWT, setSessionCookie } from "../_jwt.js";
import { brandedHtml, emailBtn, emailDivider, emailMuted } from "../_email.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "Dalton@aschemanagency.com";
const FROM_ADDR   = () => process.env.FROM_EMAIL || "noreply@guardiansofganja.com";

async function sendEmail(resendKey, to, subject, html) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Guardians of Ganja <${FROM_ADDR()}>`, to: [to], subject, html }),
  }).catch(e => console.error("[accept-invite] Email failed:", e.message));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, full_name, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "token and password are required" });
  if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT id, email, role, expires_at, accepted_at
    FROM user_invites WHERE token = ${token} LIMIT 1
  `;
  if (!rows.length)          return res.status(404).json({ error: "Invalid invite" });
  const inv = rows[0];
  if (inv.accepted_at)       return res.status(410).json({ error: "Invite already used" });
  if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: "Invite expired" });

  const dup = await sql`SELECT id FROM user_profiles WHERE email = ${inv.email} LIMIT 1`;
  if (dup.length) return res.status(409).json({ error: "An account with this email already exists" });

  const hash = await bcrypt.hash(password, 12);
  const name = (full_name || "").trim() || inv.email.split("@")[0];

  const [user] = await sql`
    INSERT INTO user_profiles (email, full_name, role, password_hash)
    VALUES (${inv.email}, ${name}, ${inv.role}, ${hash})
    RETURNING id, email, full_name, role
  `;

  await sql`UPDATE user_invites SET accepted_at = now() WHERE id = ${inv.id}`;

  const jwtToken = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, jwtToken);

  // Fire-and-forget emails
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const firstName  = name.split(" ")[0];
    const isAdmin    = user.role === "admin";
    const roleLabel  = isAdmin ? "Admin" : "Client";
    const portalUrl  = isAdmin ? "https://guardiansofganja.com/admin" : "https://guardiansofganja.com/dashboard";
    const portalName = isAdmin ? "Admin Panel" : "My Portal";

    // Welcome email → new user
    sendEmail(resendKey, user.email, `Welcome to Guardians of Ganja — ${roleLabel} Portal`, brandedHtml({
      preheader: `Your ${roleLabel} portal account is active and ready to use.`,
      body: `
        <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Invite Accepted</p>
        <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">You're all set, ${firstName}!<br>Your account is active.</h1>
        <p style="margin:0 0 16px;color:#c4ddd0;">Your invitation has been accepted and your <strong style="color:#e8f5ee;">${roleLabel} Portal</strong> account is ready to go.</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;color:#2fb073;font-size:13px;font-weight:700;">${isAdmin ? "Your admin access includes" : "What you can do in your portal"}</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${isAdmin ? `
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Manage clients, applications, and users</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Send email campaigns to subscribers and clients</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; View analytics and track quote submissions</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Communicate with clients via the inbox</td></tr>
              ` : `
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Submit a quote application for your operation</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Access your quotes, policies, and documents</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Message your agent directly from the inbox</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Track the status of your application in real time</td></tr>
              `}
            </table>
          </td></tr>
        </table>
        ${emailBtn(portalUrl, `Go to ${portalName}`)}
        ${emailDivider}
        <p style="margin:0;color:#c4ddd0;font-size:14px;">Questions? Reach us at <a href="mailto:info@guardiansofganja.com" style="color:#2fb073;text-decoration:none;">info@guardiansofganja.com</a></p>
        ${emailMuted("You're receiving this because you accepted an invitation to guardiansofganja.com.")}
      `,
    }));

    // Admin notification → broker
    sendEmail(resendKey, ADMIN_EMAIL, `Invite Accepted — ${name} (${roleLabel})`, brandedHtml({
      preheader: `${name} accepted their ${roleLabel} invitation`,
      body: `
        <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Invite Accepted</p>
        <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:22px;font-weight:800;">A user accepted their invitation</h1>
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
            <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;">Role</td>
            <td style="padding:10px 14px;color:#c4ddd0;font-size:13px;">${roleLabel}</td>
          </tr>
        </table>
        ${emailBtn("https://guardiansofganja.com/admin", "View in Admin Panel")}
        ${emailMuted("This is an automated admin notification.")}
      `,
    }));
  }

  return res.status(200).json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
}
