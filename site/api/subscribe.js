// /api/subscribe.js
// Public endpoint — inserts a new subscriber into Neon and triggers a welcome email.
// POST body: { name: string, email: string, consent: boolean }

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name = "", email = "", consent = false } = req.body || {};

  // Input validation
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
      VALUES (
        ${cleanEmail},
        ${cleanName},
        true,
        now(),
        'homepage'
      )
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (err) {
    console.error("[subscribe] DB error:", err.message);
    return res.status(500).json({ error: "Subscription failed. Please try again." });
  }

  // Fire-and-forget welcome email (failure must not block the response)
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || "http://localhost:3000";

    await fetch(`${base}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.WEBHOOK_SECRET || "",
      },
      body: JSON.stringify({
        trigger_type:    "welcome_subscriber",
        recipient_email: cleanEmail,
        recipient_name:  cleanName,
        variables: {
          full_name: cleanName || cleanEmail.split("@")[0],
          email:     cleanEmail,
        },
      }),
    });
  } catch (emailErr) {
    console.error("[subscribe] Welcome email failed:", emailErr.message);
  }

  return res.status(200).json({ success: true });
}
