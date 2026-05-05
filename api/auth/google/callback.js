// GET /api/auth/google/callback — Google OAuth callback handler

import { neon } from "@neondatabase/serverless";
import { signJWT, setSessionCookie } from "../../_jwt.js";

export default async function handler(req, res) {
  const { code, error } = req.query || {};
  const siteUrl     = process.env.SITE_URL || "https://guardiansofganja.com";
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  if (error || !code) {
    return res.redirect(302, "/login?error=google_cancelled");
  }

  // Exchange code for tokens
  let tokens;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || "token exchange failed");
  } catch (e) {
    console.error("[google/callback] token exchange error:", e.message);
    return res.redirect(302, "/login?error=google_failed");
  }

  // Get user profile from Google
  let googleUser;
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    googleUser = await profileRes.json();
    if (!googleUser.email) throw new Error("no email in profile");
  } catch (e) {
    console.error("[google/callback] profile fetch error:", e.message);
    return res.redirect(302, "/login?error=google_failed");
  }

  const sql   = neon(process.env.DATABASE_URL);
  const email = googleUser.email.toLowerCase().trim();
  const name  = googleUser.name || googleUser.email.split("@")[0];

  // Find or create user
  let user;
  const existing = await sql`SELECT id, email, full_name, role FROM user_profiles WHERE email = ${email} LIMIT 1`;
  if (existing.length) {
    user = existing[0];
    // Update name if it was empty
    if (!user.full_name && name) {
      await sql`UPDATE user_profiles SET full_name = ${name}, updated_at = now() WHERE id = ${user.id}`;
      user.full_name = name;
    }
  } else {
    const [created] = await sql`
      INSERT INTO user_profiles (email, full_name, role, password_hash)
      VALUES (${email}, ${name}, 'customer', '')
      RETURNING id, email, full_name, role
    `;
    user = created;
  }

  const token = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, token);

  return res.redirect(302, user.role === "admin" ? "/admin" : "/dashboard");
}
