// /api/email-campaign.js
// Admin-only broadcast email campaigns via Resend.
//
// GET  /api/email-campaign — campaign history
// POST /api/email-campaign — create + send a campaign

import { neon }  from "@neondatabase/serverless";
import { verifyJWT, getTokenFromRequest } from "./_jwt.js";

function requireAdmin(req) {
  const payload = verifyJWT(getTokenFromRequest(req));
  return payload && payload.role === "admin" ? payload : null;
}

async function getRecipients(sql, targetGroup) {
  const emails = new Set();

  if (targetGroup === "subscribers" || targetGroup === "all") {
    const rows = await sql`SELECT email FROM subscribers`;
    rows.forEach(r => emails.add(r.email));
  }
  if (targetGroup === "customers" || targetGroup === "all") {
    const rows = await sql`SELECT email FROM user_profiles WHERE role = 'customer'`;
    rows.forEach(r => emails.add(r.email));
  }
  if (targetGroup === "admins") {
    const rows = await sql`SELECT email FROM user_profiles WHERE role = 'admin'`;
    rows.forEach(r => emails.add(r.email));
  }

  return Array.from(emails);
}

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: campaign history ────────────────────────────────────────────────────
  if (req.method === "GET") {
    const campaigns = await sql`
      SELECT id, subject, target_group, recipient_count, status, sent_at, created_at
      FROM email_campaigns
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return res.status(200).json({ campaigns });
  }

  // ── POST: send campaign ──────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { subject, body_html, target_group = "all" } = req.body || {};

    if (!subject || !body_html) return res.status(400).json({ error: "subject and body_html are required" });
    if (!["all", "subscribers", "customers", "admins"].includes(target_group)) {
      return res.status(400).json({ error: "Invalid target_group" });
    }

    const recipients = await getRecipients(sql, target_group);
    if (!recipients.length) return res.status(200).json({ success: true, sent: 0, message: "No recipients" });

    const [campaign] = await sql`
      INSERT INTO email_campaigns (subject, body_html, status, target_group, created_by, recipient_count, sent_at)
      VALUES (${subject}, ${body_html}, 'sent', ${target_group}, ${admin.sub}, ${recipients.length}, now())
      RETURNING id
    `;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

    let sentCount = 0;
    const sendLogs = [];

    for (const email of recipients) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from:    `Guardians of Ganja <${process.env.FROM_EMAIL || "noreply@guardiansofganja.com"}>`,
            to:      [email],
            subject,
            html:    body_html,
          }),
        });
        if (r.ok) { sentCount++; sendLogs.push({ campaign_id: campaign.id, recipient_email: email }); }
        else { console.error(`[email-campaign] Failed to ${email}:`, await r.json().catch(() => ({}))); }
      } catch (e) {
        console.error(`[email-campaign] Error sending to ${email}:`, e.message);
      }
    }

    if (sendLogs.length) {
      await sql`
        INSERT INTO email_sends (campaign_id, recipient_email)
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(sendLogs)}::jsonb)
          AS t(campaign_id uuid, recipient_email text)
      `;
    }

    return res.status(200).json({ success: true, sent: sentCount, total: recipients.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
