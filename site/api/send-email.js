// Vercel Serverless Function: /api/send-email
// Called by Supabase Database Webhooks
// POST body: { trigger_type, recipient_email, recipient_name, variables: {} }
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, WEBHOOK_SECRET

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

  // ── Fetch active template from Supabase ─────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Supabase env vars not set" });
  }

  const templateRes = await fetch(
    `${supabaseUrl}/rest/v1/email_templates?trigger_type=eq.${encodeURIComponent(trigger_type)}&active=eq.true&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!templateRes.ok) {
    return res.status(502).json({ error: "Failed to fetch template from Supabase" });
  }

  const templates = await templateRes.json();
  if (!templates || templates.length === 0) {
    // Template inactive or not found — silently skip
    return res.status(200).json({ skipped: true, reason: "No active template found" });
  }

  const template = templates[0];

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
      from: "Guardians of Ganja <no-reply@guardians-of-ganja.vercel.app>",
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
