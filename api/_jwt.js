// Shared JWT helpers — HMAC-SHA256, no external dependencies beyond Node crypto
import { createHmac } from "crypto";

const ALG = "HS256";
const EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

function b64url(buf) {
  return (typeof buf === "string" ? Buffer.from(buf) : buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signJWT(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");

  const header  = b64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const body    = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + EXPIRES_IN, iat: Math.floor(Date.now() / 1000) }));
  const sig     = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifyJWT(token) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const expected = b64url(createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest());
    if (expected !== parts[2]) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// Parse the session cookie from a request
export function getTokenFromRequest(req) {
  const cookie = req.headers.cookie || "";
  const match  = cookie.match(/(?:^|;\s*)gog_session=([^;]+)/);
  return match ? match[1] : null;
}

// Set the session cookie on a response
export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie",
    `gog_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${EXPIRES_IN}${process.env.NODE_ENV !== "development" ? "; Secure" : ""}`
  );
}

// Clear the session cookie
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "gog_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
}
