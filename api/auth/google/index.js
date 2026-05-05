// GET /api/auth/google — redirects user to Google OAuth consent screen

export default function handler(req, res) {
  const clientId    = process.env.GOOGLE_CLIENT_ID;
  const siteUrl     = process.env.SITE_URL || "https://guardiansofganja.com";
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "online",
    prompt:        "select_account",
  });

  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
