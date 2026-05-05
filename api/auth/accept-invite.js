// POST /api/auth/accept-invite
// Body: { token, full_name, password }
// Validates invite token, creates user account, marks invite used, sets session cookie.

import { neon }   from "@neondatabase/serverless";
import bcrypt     from "bcryptjs";
import { signJWT, setSessionCookie } from "../_jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, full_name, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "token and password are required" });
  if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT id, email, role, expires_at, accepted_at
    FROM user_invites WHERE token = ${token} LIMIT 1
  `;
  if (!rows.length)          return res.status(404).json({ error: "Invalid invite" });
  const inv = rows[0];
  if (inv.accepted_at)       return res.status(410).json({ error: "Invite already used" });
  if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: "Invite expired" });

  // Check email not already registered (race condition guard)
  const dup = await sql`SELECT id FROM user_profiles WHERE email = ${inv.email} LIMIT 1`;
  if (dup.length) return res.status(409).json({ error: "An account with this email already exists" });

  const hash = await bcrypt.hash(password, 12);
  const name = (full_name || "").trim() || inv.email.split("@")[0];

  const [user] = await sql`
    INSERT INTO user_profiles (email, full_name, role, password_hash)
    VALUES (${inv.email}, ${name}, ${inv.role}, ${hash})
    RETURNING id, email, full_name, role
  `;

  await sql`UPDATE user_invites SET accepted_at = now() WHERE id = ${inv.id}`;

  const jwtToken = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, jwtToken);

  return res.status(200).json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
}
