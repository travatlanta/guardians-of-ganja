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
import { brandedHtml, emailBtn, emailDivider, emailMuted, sendMail } from "./_email.js";

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

    // Send emails (broker notification + customer confirmation)
    const brokerTo  = (process.env.ADMIN_EMAIL || "Dalton@aschemanagency.com").replace(/^﻿/, "").trim();
    const submitted = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    try {
      // ── Broker notification ───────────────────────────────────────────────────
      const summaryRows = Object.entries(form_data)
        .map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px;color:#4a7a5a;font-size:13px;font-weight:600;white-space:nowrap;border-bottom:1px solid rgba(47,176,115,0.08);">${k}</td>
            <td style="padding:8px 12px;color:#c4ddd0;font-size:13px;border-bottom:1px solid rgba(47,176,115,0.08);">${Array.isArray(v) ? v.join(", ") : v}</td>
          </tr>`)
        .join("");

      const brokerHtml = brandedHtml({
        preheader: `New quote application from ${contact_name || contact_email}`,
        body: `
          <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">New Submission</p>
          <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:24px;font-weight:800;line-height:1.2;">Quote Application Received</h1>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);">
            <tr>
              <td style="padding:8px 12px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Applicant</td>
              <td style="padding:8px 12px;color:#e8f5ee;font-size:13px;font-weight:700;border-bottom:1px solid rgba(47,176,115,0.08);">${contact_name || "(no name)"}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Email</td>
              <td style="padding:8px 12px;color:#c4ddd0;font-size:13px;border-bottom:1px solid rgba(47,176,115,0.08);">${contact_email}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#4a7a5a;font-size:13px;font-weight:600;">Submitted</td>
              <td style="padding:8px 12px;color:#c4ddd0;font-size:13px;">${submitted}</td>
            </tr>
          </table>
          <p style="margin:0 0 10px;color:#4a7a5a;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Application Details</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.04);border-radius:10px;border:1px solid rgba(47,176,115,0.1);">
            ${summaryRows}
          </table>
          ${emailBtn("https://guardiansofganja.com/admin", "View in Admin Panel")}
          ${emailMuted("This is an automated notification. Log in to the admin panel to update the application status.")}
        `,
      });

      sendMail({ to: brokerTo, subject: `New Quote Application — ${contact_name || contact_email}`, html: brokerHtml })
        .catch(e => console.error("[quote-application] Broker email failed:", e.message));

      // ── Customer confirmation ─────────────────────────────────────────────────
      const customerName = contact_name ? contact_name.split(" ")[0] : "there";
      const customerHtml = brandedHtml({
        preheader: "We've received your quote application and will be in touch shortly.",
        body: `
          <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Application Received</p>
          <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">Thanks, ${customerName}!<br>We've got your application.</h1>
          <p style="margin:0 0 16px;color:#c4ddd0;">Your cannabis insurance quote application has been successfully submitted. Our team will review your information and reach out with a customized quote tailored to your operation.</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:8px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 10px;color:#2fb073;font-size:13px;font-weight:700;">What happens next?</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Our team reviews your application</td></tr>
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; We prepare a customized quote for your operation</td></tr>
                <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; You'll hear from us within 1&ndash;2 business days</td></tr>
              </table>
            </td></tr>
          </table>
          ${emailDivider}
          <p style="margin:0 0 14px;color:#c4ddd0;font-size:14px;">Have questions in the meantime? You can reach us at <a href="mailto:Dalton@aschemanagency.com" style="color:#2fb073;text-decoration:none;">Dalton@aschemanagency.com</a> or log in to your portal to send a message directly.</p>
          ${emailBtn("https://guardiansofganja.com/dashboard", "Go to My Portal")}
          ${emailMuted("You're receiving this because you submitted a quote application on guardiansofganja.com.")}
        `,
      });

      sendMail({ to: contact_email, subject: "We received your quote application — Guardians of Ganja", html: customerHtml })
        .catch(e => console.error("[quote-application] Customer email failed:", e.message));
    } catch(e) { console.error("[quote-application] email error:", e.message); }

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
