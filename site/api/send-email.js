// Vercel Serverless Function: /api/send-email
// Triggered by internal API calls (subscribe, admin actions, etc.)
// POST body: { trigger_type, recipient_email, recipient_name, variables: {} }
// Requires env vars: DATABASE_URL, RESEND_API_KEY, WEBHOOK_SECRET

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate shared secret ──────────────────────────────
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { trigger_type, recipient_email, recipient_name, variables = {} } = req.body;

  if (!trigger_type || !recipient_email) {
    return res.status(400).json({ error: "Missing trigger_type or recipient_email" });
  }

  // ── Fetch active template from Neon ─────────────────────
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: "DATABASE_URL not configured" });
  }

  const sql = neon(dbUrl);
  let templateRows;
  try {
    templateRows = await sql`
      SELECT subject, body_html FROM email_templates
      WHERE trigger_type = ${trigger_type} AND active = true
      LIMIT 1
    `;
  } catch (dbErr) {
    console.error("[send-email] DB error:", dbErr.message);
    return res.status(502).json({ error: "Failed to fetch template from database" });
  }

  if (!templateRows || templateRows.length === 0) {
    // Template inactive or not found — silently skip
    return res.status(200).json({ skipped: true, reason: "No active template found" });
  }

  const template = templateRows[0];

  // ── Interpolate {{variable}} placeholders ───────────────
  function interpolate(str, vars) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
    );
  }

  const allVars = { full_name: recipient_name || "", ...variables };
  const subject  = interpolate(template.subject, allVars);
  const bodyHtml = interpolate(template.body_html, allVars);

  // ── Send via Resend REST API ─────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: "RESEND_API_KEY not set" });
  }

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "Guardians of Ganja <noreply@guardiansofganja.com>",
      to: [recipient_email],
      subject,
      html: bodyHtml,
    }),
  });

  if (!sendRes.ok) {
    const errBody = await sendRes.text();
    return res.status(502).json({ error: "Resend API error", detail: errBody });
  }

  const sendData = await sendRes.json();
  return res.status(200).json({ success: true, id: sendData.id });
}
