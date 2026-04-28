// /api/clerk-webhook.js
// Syncs Clerk user lifecycle events → Neon user_profiles table.
// Secured by Svix webhook signature (CLERK_WEBHOOK_SECRET env var).
// Register this URL in Clerk Dashboard → Webhooks:
//   https://yourdomain.com/api/clerk-webhook
//   Events: user.created, user.updated, user.deleted

import { neon } from "@neondatabase/serverless";

// ── Svix HMAC-SHA256 verification (no npm required beyond @neondatabase) ─────
async function verifySvix(req) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return false;

  const svixId        = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Svix signs: "{svix-id}.{svix-timestamp}.{raw body}"
  const rawBody  = JSON.stringify(req.body);
  const baseStr  = `${svixId}.${svixTimestamp}.${rawBody}`;
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sigBuf  = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(baseStr));
  const computed = "v1," + Buffer.from(sigBuf).toString("base64");

  // svix-signature may contain multiple space-separated values
  return svixSignature.split(" ").some((s) => s === computed);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const valid = await verifySvix(req).catch(() => false);
  if (!valid) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).json({ error: "Missing event type or data" });
  }

  const sql = neon(process.env.DATABASE_URL);

  if (type === "user.created" || type === "user.updated") {
    const email     = data.email_addresses?.[0]?.email_address || "";
    const full_name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    const role      = data.public_metadata?.role || "customer";

    await sql`
      INSERT INTO user_profiles (clerk_user_id, email, full_name, role)
      VALUES (${data.id}, ${email}, ${full_name}, ${role})
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email      = EXCLUDED.email,
        full_name  = EXCLUDED.full_name,
        role       = EXCLUDED.role,
        updated_at = now()
    `;
    return res.status(200).json({ success: true, action: type });
  }

  if (type === "user.deleted") {
    await sql`DELETE FROM user_profiles WHERE clerk_user_id = ${data.id}`;
    return res.status(200).json({ success: true, action: "user.deleted" });
  }

  // Unhandled event type — acknowledge and ignore
  return res.status(200).json({ success: true, action: "ignored" });
}
