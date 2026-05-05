// POST /api/auth/invite  — admin sends an email invite
// GET  /api/auth/invite?token=xxx — validate a token (returns email + role)
// POST /api/auth/invite/accept — (see accept.js)

import { neon }  from "@neondatabase/serverless";
import crypto    from "crypto";
import { verifyJWT, getTokenFromRequest } from "../_jwt.js";

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
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

    const roleLabel = role === "admin" ? "Admin" : "Client";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    `Guardians of Ganja <${process.env.FROM_EMAIL || "noreply@guardiansofganja.com"}>`,
        to:      [email],
        subject: `You've been invited to Guardians of Ganja Portal`,
        html: `
          <h2>You're invited!</h2>
          <p>You've been invited to access the Guardians of Ganja ${roleLabel} Portal.</p>
          <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#2fb073;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invite &amp; Set Password</a></p>
          <p style="color:#888;font-size:0.85rem;">This link expires in 7 days. If you didn't expect this, ignore it.</p>
        `,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: `Email failed: ${err.message || r.status}` });
    }

    return res.status(200).json({ success: true, message: `Invite sent to ${email}` });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
