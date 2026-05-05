// /api/subscribe.js
// Public endpoint — inserts a new subscriber into Neon and sends a welcome email.
// POST body: { name: string, email: string, consent: boolean }

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name = "", email = "", consent = false } = req.body || {};

  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (!consent) {
    return res.status(400).json({ error: "Consent to receive emails is required." });
  }

  const cleanName = String(name).trim().slice(0, 100);
  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      INSERT INTO subscribers (email, name, consent, consented_at, source)
      VALUES (${cleanEmail}, ${cleanName}, true, now(), 'homepage')
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (err) {
    console.error("[subscribe] DB error:", err.message);
    return res.status(500).json({ error: "Subscription failed. Please try again." });
  }

  // Fire-and-forget welcome email
  try {
    const templateRows = await sql`
      SELECT subject, body_html FROM email_templates
      WHERE trigger_type = 'welcome_subscriber' AND active = true
      LIMIT 1
    `;
    if (templateRows.length) {
      const tpl = templateRows[0];
      const vars = { full_name: cleanName || cleanEmail.split("@")[0], email: cleanEmail };
      const interpolate = (str) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || "");
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || "Guardians of Ganja <noreply@guardiansofganja.com>",
            to: [cleanEmail],
            subject: interpolate(tpl.subject),
            html: interpolate(tpl.body_html),
          }),
        });
      }
    }
  } catch (emailErr) {
    console.error("[subscribe] Welcome email failed:", emailErr.message);
  }

  return res.status(200).json({ success: true });
}
