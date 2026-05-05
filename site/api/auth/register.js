// POST /api/auth/register
// Admin-only: create a new user (customer or admin).
// Body: { email, password, full_name, role, phone?, company? }

import { neon }   from "@neondatabase/serverless";
import bcrypt     from "bcryptjs";
import { verifyJWT, getTokenFromRequest } from "../_jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Must be a logged-in admin
  const payload = verifyJWT(getTokenFromRequest(req));
  if (!payload || payload.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const { email, password, full_name, role = "customer", phone = "", company = "" } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "email, password, and full_name are required" });
  }
  if (!["customer", "admin"].includes(role)) {
    return res.status(400).json({ error: "role must be customer or admin" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const sql = neon(process.env.DATABASE_URL);

  const existing = await sql`SELECT id FROM user_profiles WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
  if (existing.length) return res.status(409).json({ error: "A user with that email already exists" });

  const password_hash = await bcrypt.hash(password, 12);

  const [user] = await sql`
    INSERT INTO user_profiles (email, full_name, role, phone, company, password_hash)
    VALUES (${email.toLowerCase().trim()}, ${full_name}, ${role}, ${phone}, ${company}, ${password_hash})
    RETURNING id, email, full_name, role, created_at
  `;

  return res.status(201).json({ user });
}
