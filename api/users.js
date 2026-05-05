// /api/users.js
// Admin-only user management.
//
// GET    /api/users  — list all profiles, subscribers, quote requests
// PATCH  /api/users  — update a user's role
// DELETE /api/users  — delete a user profile

import { neon }  from "@neondatabase/serverless";
import { verifyJWT, getTokenFromRequest } from "./_jwt.js";

function requireAdmin(req) {
  const payload = verifyJWT(getTokenFromRequest(req));
  return payload && payload.role === "admin" ? payload : null;
}

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) return res.status(403).json({ error: "Forbidden" });

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: all user groups ────────────────────────────────────────────────────
  if (req.method === "GET") {
    const [profiles, subscribers, quoteApps, pendingInvites] = await Promise.all([
      sql`
        SELECT id, email, full_name, company, phone, role, created_at
        FROM user_profiles
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id::text, email, name AS full_name, source, created_at
        FROM subscribers
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id::text, contact_email AS email, contact_name AS full_name, status, submitted_at AS created_at
        FROM quote_applications
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id::text, email, role, expires_at, created_at
        FROM user_invites
        WHERE accepted_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC
      `,
    ]);

    return res.status(200).json({ profiles, subscribers, quoteApps, pendingInvites });
  }

  // ── PATCH: update role ──────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const { id, role } = req.body || {};
    if (!id || !["customer", "admin"].includes(role)) {
      return res.status(400).json({ error: "id and role (customer|admin) required" });
    }

    await sql`UPDATE user_profiles SET role = ${role}, updated_at = now() WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  // ── DELETE: remove a user ───────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });
    if (id === admin.sub) return res.status(400).json({ error: "Cannot delete your own account" });

    await sql`DELETE FROM user_profiles WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
