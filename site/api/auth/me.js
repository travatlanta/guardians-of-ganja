// GET /api/auth/me
// Returns the current user from the session cookie, or 401.

import { verifyJWT, getTokenFromRequest } from "../_jwt.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token   = getTokenFromRequest(req);
  const payload = verifyJWT(token);

  if (!payload) return res.status(401).json({ error: "Not authenticated" });

  return res.status(200).json({
    user: { id: payload.sub, email: payload.email, full_name: payload.name, role: payload.role }
  });
}
