// POST /api/auth/login
// Body: { email, password }
// Sets an httpOnly session cookie on success.

import { neon }              from "@neondatabase/serverless";
import bcrypt                from "bcryptjs";
import { signJWT, setSessionCookie } from "../_jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT id, clerk_user_id, email, full_name, role, password_hash
    FROM user_profiles
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;

  if (!rows.length) return res.status(401).json({ error: "Invalid email or password" });

  const user = rows[0];
  if (!user.password_hash) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = signJWT({ sub: user.id || user.clerk_user_id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, token);

  return res.status(200).json({ user: { email: user.email, name: user.full_name, role: user.role } });
}
