// POST /api/auth/invite  — admin sends an email invite
// GET  /api/auth/invite?token=xxx — validate a token (returns email + role)
// POST /api/auth/invite/accept — (see accept.js)

import { neon }  from "@neondatabase/serverless";
import crypto    from "crypto";
import { verifyJWT, getTokenFromRequest } from "../_jwt.js";
import { brandedHtml, emailBtn, emailDivider, emailMuted, sendMail } from "../_email.js";

function requireAdmin(req) {
  const payload = verifyJWT(getTokenFromRequest(req));
  return payload && payload.role === "admin" ? payload : null;
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // ── GET: validate invite token ─────────────────────────────────────────────
  if (req.method === "GET") {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: "token required" });

    const rows = await sql`
      SELECT email, role, expires_at, accepted_at
      FROM user_invites WHERE token = ${token} LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: "Invalid or expired invite" });
    const inv = rows[0];
    if (inv.accepted_at)       return res.status(410).json({ error: "Invite already used" });
    if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: "Invite expired" });
    return res.status(200).json({ email: inv.email, role: inv.role });
  }

  // ── POST: send invite (admin only) ─────────────────────────────────────────
  if (req.method === "POST") {
    const admin = requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { email, role = "customer" } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });
    if (!["customer", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });

    // Check not already a registered user
    const existing = await sql`SELECT id FROM user_profiles WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    if (existing.length) return res.status(409).json({ error: "A user with that email already exists" });

    // Expire any pending invites for this email and create a new one
    await sql`DELETE FROM user_invites WHERE email = ${email.toLowerCase().trim()} AND accepted_at IS NULL`;

    const token = crypto.randomBytes(32).toString("hex");
    await sql`
      INSERT INTO user_invites (email, role, token, invited_by)
      VALUES (${email.toLowerCase().trim()}, ${role}, ${token}, ${admin.sub})
    `;

    const inviteUrl = `${process.env.SITE_URL || "https://guardiansofganja.com"}/invite?token=${token}`;
    const roleLabel = role === "admin" ? "Admin" : "Client";
    const html = brandedHtml({
      preheader: `You've been invited to access the Guardians of Ganja ${roleLabel} Portal.`,
      body: `
        <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">You're Invited</p>
        <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">Welcome to the<br>Guardians of Ganja Portal</h1>
        <p style="margin:0 0 8px;color:#c4ddd0;">You've been invited to access the <strong style="color:#e8f5ee;">${roleLabel} Portal</strong> for Guardians of Ganja — your cannabis insurance hub.</p>
        <p style="margin:0 0 4px;color:#c4ddd0;">Click the button below to accept your invite and set your password. The link is valid for <strong style="color:#e8f5ee;">7 days</strong>.</p>
        ${emailBtn(inviteUrl, "Accept Invite &amp; Set Password")}
        ${emailDivider}
        <p style="margin:0 0 8px;color:#c4ddd0;font-size:14px;">Once inside, you'll have access to:</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
          ${role === "admin" ? `
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">Admin Panel</span> — manage clients, applications &amp; campaigns</td></tr>
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">Client Inbox</span> — communicate directly with policyholders</td></tr>
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">Analytics</span> — track submissions and engagement</td></tr>
          ` : `
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">My Application</span> — start or track your insurance application</td></tr>
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">Documents</span> — access your quotes and policies</td></tr>
          <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; <span style="color:#2fb073;font-weight:600;">Inbox</span> — message your agent directly</td></tr>
          `}
        </table>
        ${emailMuted("If you didn't expect this invitation, you can safely ignore this email. The link will expire automatically.")}
      `,
    });

    let r;
    try {
      r = await sendMail({ to: email, subject: `You've been invited to the Guardians of Ganja ${roleLabel} Portal`, html });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: `Email failed: ${err.message || r.status}` });
    }

    return res.status(200).json({ success: true, message: `Invite sent to ${email}` });
  }

  // ── DELETE: revoke a pending invite (admin only) ───────────────────────────
  if (req.method === "DELETE") {
    const admin = requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    await sql`DELETE FROM user_invites WHERE id = ${id} AND accepted_at IS NULL`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
