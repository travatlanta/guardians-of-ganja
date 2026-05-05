// /api/quote-application.js
// CRUD for insurance quote applications (multi-step form submissions).
//
// GET    /api/quote-application        — customer: their own app; admin with ?all=true: all apps
// POST   /api/quote-application        — create or update (upsert) caller's application
// PATCH  /api/quote-application        — admin only: update application status
// DELETE /api/quote-application        — admin only: delete an application

import { neon } from "@neondatabase/serverless";

const b64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");

// Verify any valid Clerk JWT; returns { userId } or null
async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
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

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// Additionally checks admin role in Neon
async function verifyAdminToken(authHeader, sql) {
  const result = await verifyToken(authHeader);
  if (!result) return null;
  const rows = await sql`SELECT role FROM user_profiles WHERE clerk_user_id = ${result.userId}`;
  if (!rows.length || rows[0].role !== "admin") return null;
  return result;
}

export default async function handler(req, res) {
  const auth = await verifyToken(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const sql = neon(process.env.DATABASE_URL);

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    // Check if admin requesting all applications
    if (req.query.all === "true") {
      const admin = await verifyAdminToken(req.headers.authorization, sql);
      if (!admin) return res.status(403).json({ error: "Forbidden" });

      const apps = await sql`
        SELECT
          qa.id, qa.clerk_user_id, qa.status, qa.form_data,
          qa.submitted_at, qa.created_at, qa.updated_at,
          up.full_name, up.email, up.company
        FROM quote_applications qa
        JOIN user_profiles up ON up.clerk_user_id = qa.clerk_user_id
        ORDER BY qa.created_at DESC
      `;
      return res.status(200).json({ applications: apps });
    }

    // Customer: return their own application
    const rows = await sql`
      SELECT id, clerk_user_id, status, form_data, submitted_at, created_at, updated_at
      FROM quote_applications
      WHERE clerk_user_id = ${auth.userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return res.status(200).json({ application: rows[0] || null });
  }

  // ── POST: create or update caller's application ──────────────────────────────
  if (req.method === "POST") {
    const { form_data, submit } = req.body || {};
    if (!form_data || typeof form_data !== "object") {
      return res.status(400).json({ error: "form_data object is required" });
    }

    const newStatus = submit ? "submitted" : "draft";
    const submittedAt = submit ? new Date().toISOString() : null;

    // Upsert: one application per user (update if exists, else insert)
    const existing = await sql`
      SELECT id FROM quote_applications WHERE clerk_user_id = ${auth.userId} ORDER BY created_at DESC LIMIT 1
    `;

    let app;
    if (existing.length) {
      const updateRows = await sql`
        UPDATE quote_applications
        SET
          form_data   = ${JSON.stringify(form_data)}::jsonb,
          status      = CASE
                          WHEN status = 'draft' THEN ${newStatus}
                          ELSE status
                        END,
          submitted_at = COALESCE(submitted_at, ${submittedAt}),
          updated_at  = now()
        WHERE id = ${existing[0].id}
        RETURNING id, status, submitted_at, updated_at
      `;
      app = updateRows[0];
    } else {
      const insertRows = await sql`
        INSERT INTO quote_applications (clerk_user_id, status, form_data, submitted_at)
        VALUES (
          ${auth.userId},
          ${newStatus},
          ${JSON.stringify(form_data)}::jsonb,
          ${submittedAt}
        )
        RETURNING id, status, submitted_at, created_at
      `;
      app = insertRows[0];
    }

    return res.status(200).json({ application: app });
  }

  // ── PATCH: admin updates status ──────────────────────────────────────────────
  if (req.method === "PATCH") {
    const admin = await verifyAdminToken(req.headers.authorization, sql);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { id, status } = req.body || {};
    const valid = ["draft", "submitted", "in_review", "quoted", "closed"];
    if (!id || !valid.includes(status)) {
      return res.status(400).json({ error: "id and valid status are required" });
    }

    await sql`
      UPDATE quote_applications SET status = ${status}, updated_at = now() WHERE id = ${id}
    `;
    return res.status(200).json({ success: true });
  }

  // ── DELETE: admin removes an application ─────────────────────────────────────
  if (req.method === "DELETE") {
    const admin = await verifyAdminToken(req.headers.authorization, sql);
    if (!admin) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    await sql`DELETE FROM quote_applications WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
