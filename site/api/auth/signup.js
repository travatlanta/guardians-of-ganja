// POST /api/auth/signup
// Open self-registration — creates a customer account.
// Body: { email, password, full_name }

import { neon }  from "@neondatabase/serverless";
import bcrypt    from "bcryptjs";
import { signJWT, setSessionCookie } from "../_jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, full_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });

  const clean = email.toLowerCase().trim();
  const sql   = neon(process.env.DATABASE_URL);

  const existing = await sql`SELECT id FROM user_profiles WHERE email = ${clean} LIMIT 1`;
  if (existing.length) return res.status(409).json({ error: "An account with that email already exists" });

  const hash = await bcrypt.hash(password, 12);
  const name = (full_name || "").trim() || clean.split("@")[0];

  const [user] = await sql`
    INSERT INTO user_profiles (email, full_name, role, password_hash)
    VALUES (${clean}, ${name}, 'customer', ${hash})
    RETURNING id, email, full_name, role
  `;

  const token = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, token);

  return res.status(200).json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
}
