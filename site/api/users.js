// /api/users.js
// Admin-only CRUD for user management.
// All requests require a valid Clerk session token from an admin-role user.
//
// GET    /api/users         — list all user groups (profiles, subscribers, quote requests)
// POST   /api/users         — invite a new user (creates Clerk user via Backend API)
// PATCH  /api/users         — update role for an existing profile
// DELETE /api/users         — delete a Clerk user + profile row

import { neon } from "@neondatabase/serverless";

// ── Clerk JWT verification using JWKS ─────────────────────────────────────────
async function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url → utf8
    const b64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");
    const header  = JSON.parse(Buffer.from(b64(parts[0]), "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(b64(parts[1]), "base64").toString("utf8"));

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Fetch Clerk JWKS
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

    // Verify admin role in Neon
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT role FROM user_profiles WHERE clerk_user_id = ${payload.sub}
    `;
    if (!rows.length || rows[0].role !== "admin") return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const admin = await verifyAdminToken(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: return all user groups ─────────────────────────────────────────────
  if (req.method === "GET") {
    const [profiles, subscribers, quoteRequests] = await Promise.all([
      sql`
        SELECT clerk_user_id AS id, email, full_name, company, phone, role, created_at
        FROM user_profiles
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id::text, email, name AS full_name, '' AS company, source, created_at
        FROM subscribers
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id::text, email, name AS full_name, company, message, submitted_at AS created_at
        FROM quote_requests
        ORDER BY submitted_at DESC
      `,
    ]);

    return res.status(200).json({ profiles, subscribers, quoteRequests });
  }

  // ── PATCH: update a profile's role ─────────────────────────────────────────
  if (req.method === "PATCH") {
    const { id, role } = req.body || {};
    if (!id || !["customer", "admin"].includes(role)) {
      return res.status(400).json({ error: "id and role (customer|admin) are required" });
    }

    // Update Neon
    await sql`
      UPDATE user_profiles SET role = ${role}, updated_at = now()
      WHERE clerk_user_id = ${id}
    `;

    // Mirror to Clerk publicMetadata
    const clerkRes = await fetch(
      `https://api.clerk.com/v1/users/${id}/metadata`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_metadata: { role } }),
      }
    );
    if (!clerkRes.ok) {
      const err = await clerkRes.json().catch(() => ({}));
      console.error("[users PATCH] Clerk metadata update failed:", err);
    }

    return res.status(200).json({ success: true });
  }

  // ── DELETE: remove a Clerk user + Neon profile ──────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    // Prevent self-deletion
    if (id === admin.userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Delete from Clerk
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    if (!clerkRes.ok && clerkRes.status !== 404) {
      const err = await clerkRes.json().catch(() => ({}));
      console.error("[users DELETE] Clerk delete failed:", err);
      return res.status(502).json({ error: "Failed to delete from Clerk" });
    }

    // Neon row is also removed via clerk-webhook, but delete directly for immediate effect
    await sql`DELETE FROM user_profiles WHERE clerk_user_id = ${id}`;

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
