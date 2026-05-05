// POST /api/auth/signup
// Open self-registration — creates a customer account.
// Body: { email, password, full_name }

import { neon }  from "@neondatabase/serverless";
import bcrypt    from "bcryptjs";
import { signJWT, setSessionCookie } from "../_jwt.js";
import { brandedHtml, emailBtn, emailDivider, emailMuted, sendMail } from "../_email.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "Dalton@aschemanagency.com";

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

  const jwtToken = signJWT({ sub: user.id, email: user.email, role: user.role, name: user.full_name });
  setSessionCookie(res, jwtToken);

  // Fire-and-forget emails
  const firstName = name.split(" ")[0];
  try {
    // Welcome email → new user
    sendMail({ to: user.email, subject: "Welcome to Guardians of Ganja", html: brandedHtml({
      preheader: "Your account is ready — let's get your cannabis business covered.",
      body: `
        <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Account Created</p>
        <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:26px;font-weight:800;line-height:1.2;">Welcome, ${firstName}!<br>Your account is ready.</h1>
        <p style="margin:0 0 16px;color:#c4ddd0;">You now have full access to the Guardians of Ganja client portal — your hub for cannabis insurance applications, documents, and direct communication with your agent.</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;color:#2fb073;font-size:13px;font-weight:700;">What you can do in your portal</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Submit a quote application for your operation</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Access your quotes, policies, and documents</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Message your agent directly from the inbox</td></tr>
              <tr><td style="padding:5px 0;color:#c4ddd0;font-size:14px;">&#10003;&nbsp; Track the status of your application in real time</td></tr>
            </table>
          </td></tr>
        </table>
        ${emailBtn("https://guardiansofganja.com/quote", "Start My Quote Application")}
        ${emailDivider}
        <p style="margin:0;color:#c4ddd0;font-size:14px;">Questions? Reply to this email or reach us at <a href="mailto:Dalton@aschemanagency.com" style="color:#2fb073;text-decoration:none;">Dalton@aschemanagency.com</a> — we typically respond within one business day.</p>
        ${emailMuted("You're receiving this because you created an account at guardiansofganja.com.")}
      `,
    })).catch(e => console.error("[signup] welcome email:", e.message));

    // Admin notification → broker
    sendMail({ to: ADMIN_EMAIL, subject: `New Account — ${name} (${user.email})`, html: brandedHtml({
      preheader: `${name} just created a client account on guardiansofganja.com`,
      body: `
        <p style="margin:0 0 6px;color:#2fb073;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">New Account</p>
        <h1 style="margin:0 0 20px;color:#e8f5ee;font-size:22px;font-weight:800;">A new client just signed up</h1>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(47,176,115,0.06);border-radius:10px;border:1px solid rgba(47,176,115,0.15);margin-bottom:24px;">
          <tr>
            <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Name</td>
            <td style="padding:10px 14px;color:#e8f5ee;font-size:13px;font-weight:700;border-bottom:1px solid rgba(47,176,115,0.08);">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;border-bottom:1px solid rgba(47,176,115,0.08);">Email</td>
            <td style="padding:10px 14px;color:#c4ddd0;font-size:13px;border-bottom:1px solid rgba(47,176,115,0.08);">${user.email}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#4a7a5a;font-size:13px;font-weight:600;">Method</td>
            <td style="padding:10px 14px;color:#c4ddd0;font-size:13px;">Email / Password</td>
          </tr>
        </table>
        ${emailBtn("https://guardiansofganja.com/admin", "View in Admin Panel")}
        ${emailMuted("This is an automated admin notification.")}
      `,
    }) }).catch(e => console.error("[signup] admin email:", e.message));
  } catch(e) { console.error("[signup] email error:", e.message); }

  return res.status(200).json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
}
