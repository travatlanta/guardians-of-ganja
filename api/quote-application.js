// /api/quote-application.js
// Anonymous quote form submissions — no login required.
// Saves to Neon and fires a notification email to the broker.
//
// POST  /api/quote-application — submit form data
// GET   /api/quote-application — admin only: list all submissions
// PATCH /api/quote-application — admin only: update status
// DELETE /api/quote-application — admin only: delete

import { neon }  from "@neondatabase/serverless";
import { verifyJWT, getTokenFromRequest } from "./_jwt.js";

function requireAdmin(req) {
  const payload = verifyJWT(getTokenFromRequest(req));
  return payload && payload.role === "admin" ? payload : null;
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // ── GET: admin lists all submissions ────────────────────────────────────────
  if (req.method === "GET") {
    const admin = requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const apps = await sql`
      SELECT id, contact_name, contact_email, status, form_data, submitted_at, created_at, updated_at
      FROM quote_applications
      ORDER BY created_at DESC
    `;
    return res.status(200).json({ applications: apps });
  }

  // ── POST: anonymous submission ──────────────────────────────────────────────
  if (req.method === "POST") {
    const { form_data, contact_email, contact_name } = req.body || {};

    if (!form_data || typeof form_data !== "object") {
      return res.status(400).json({ error: "form_data is required" });
    }
    if (!contact_email) {
      return res.status(400).json({ error: "contact_email is required" });
    }

    const [app] = await sql`
      INSERT INTO quote_applications (contact_email, contact_name, status, form_data, submitted_at)
      VALUES (
        ${contact_email.toLowerCase().trim()},
        ${contact_name || ""},
        'submitted',
        ${JSON.stringify(form_data)}::jsonb,
        now()
      )
      RETURNING id, status, submitted_at, created_at
    `;

    // Notify broker via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const summaryRows = Object.entries(form_data)
        .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap">${k}</td><td style="padding:4px 8px">${Array.isArray(v) ? v.join(", ") : v}</td></tr>`)
        .join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    `Guardians of Ganja <${process.env.FROM_EMAIL || "noreply@guardiansofganja.com"}>`,
          to:      ["Dalton@aschemanagency.com"],
          subject: `New Quote Application — ${contact_name || contact_email}`,
          html: `
            <h2 style="color:#2fb073">New Quote Application</h2>
            <p><strong>From:</strong> ${contact_name || "(no name)"} &lt;${contact_email}&gt;</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <table style="border-collapse:collapse;width:100%;margin-top:1rem;font-size:14px">
              ${summaryRows}
            </table>
            <p style="margin-top:1.5rem">
              <a href="https://guardiansofganja.com/admin" style="color:#2fb073">View in Admin Panel →</a>
            </p>
          `,
        }),
      }).catch(e => console.error("[quote-application] Email failed:", e.message));
    }

    return res.status(200).json({ success: true, id: app.id });
  }

  // ── PATCH: admin updates status ─────────────────────────────────────────────
  if (req.method === "PATCH") {
    const admin = requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { id, status } = req.body || {};
    const valid = ["submitted", "in_review", "quoted", "closed"];
    if (!id || !valid.includes(status)) {
      return res.status(400).json({ error: "id and valid status required" });
    }

    await sql`UPDATE quote_applications SET status = ${status}, updated_at = now() WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  // ── DELETE: admin removes ───────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const admin = requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    await sql`DELETE FROM quote_applications WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
