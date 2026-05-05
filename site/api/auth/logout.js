// POST /api/auth/logout
// Clears the session cookie.

import { clearSessionCookie } from "../_jwt.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
