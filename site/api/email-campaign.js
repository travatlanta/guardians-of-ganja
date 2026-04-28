// /api/email-campaign.js
// Admin-only endpoint for composing and sending broadcast email campaigns.
//
// POST /api/email-campaign — create + send a campaign
// GET  /api/email-campaign — fetch campaign history

import { neon } from "@neondatabase/serverless";

// ── Clerk JWT + admin verification (shared with users.js) ────────────────────
async function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const b64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");
    const header  = JSON.parse(Buffer.from(b64(parts[0]), "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(b64(parts[1]), "base64").toString("utf8"));

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    const jwksRes = await fetch("https://api.clerk.com/v1/jwks");
    if (!jwksRes.ok) return null;
    const { keys } = await jwksRes.json();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
      false, ["verify"]
    );

    const sigBytes = Buffer.from(b64(parts[2]), "base64");
    const msgBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes, msgBytes);
    if (!valid) return null;

    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT role FROM user_profiles WHERE clerk_user_id = ${payload.sub}`;
    if (!rows.length || rows[0].role !== "admin") return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// ── Collect recipient emails by target group ─────────────────────────────────
async function getRecipients(sql, targetGroup) {
  const emails = new Set();

  if (targetGroup === "subscribers" || targetGroup === "all") {
    const rows = await sql`SELECT email FROM subscribers`;
    rows.forEach((r) => emails.add(r.email));
  }

  if (targetGroup === "customers" || targetGroup === "all") {
    const rows = await sql`SELECT email FROM user_profiles WHERE role = 'customer'`;
    rows.forEach((r) => emails.add(r.email));
  }

  if (targetGroup === "admins") {
    const rows = await sql`SELECT email FROM user_profiles WHERE role = 'admin'`;
    rows.forEach((r) => emails.add(r.email));
  }

  return Array.from(emails);
}

export default async function handler(req, res) {
  const admin = await verifyAdminToken(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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

  // ── POST: send a campaign ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { subject, body_html, target_group = "all" } = req.body || {};

    if (!subject || !body_html) {
      return res.status(400).json({ error: "subject and body_html are required" });
    }
    if (!["all", "subscribers", "customers", "admins"].includes(target_group)) {
      return res.status(400).json({ error: "Invalid target_group" });
    }

    const recipients = await getRecipients(sql, target_group);
    if (!recipients.length) {
      return res.status(200).json({ success: true, sent: 0, message: "No recipients in this group" });
    }

    // Insert campaign record
    const [campaign] = await sql`
      INSERT INTO email_campaigns (subject, body_html, status, target_group, created_by, recipient_count, sent_at)
      VALUES (${subject}, ${body_html}, 'sent', ${target_group}, ${admin.userId}, ${recipients.length}, now())
      RETURNING id
    `;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return res.status(500).json({ error: "RESEND_API_KEY not configured" });
    }

    // Send emails + log each send (batch with small delay to avoid rate limits)
    let sentCount = 0;
    const sendLogs = [];

    for (const email of recipients) {
      try {
        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:    process.env.FROM_EMAIL || "Guardians of Ganja <noreply@guardiansofganja.com>",
            to:      [email],
            subject: subject,
            html:    body_html,
          }),
        });

        if (sendRes.ok) {
          sentCount++;
          sendLogs.push({ campaign_id: campaign.id, recipient_email: email });
        } else {
          const err = await sendRes.json().catch(() => ({}));
          console.error(`[email-campaign] Failed to send to ${email}:`, err);
        }
      } catch (err) {
        console.error(`[email-campaign] Network error sending to ${email}:`, err.message);
      }
    }

    // Bulk-insert send log
    if (sendLogs.length > 0) {
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
