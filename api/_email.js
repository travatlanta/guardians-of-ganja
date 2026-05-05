// Shared branded email wrapper for all transactional emails.
// Usage: brandedHtml({ preheader, body }) → complete HTML string

const LOGO_URL  = "https://guardiansofganja.com/assets/img/logo-full.png";
const SITE_URL  = "https://guardiansofganja.com";
const FROM_NAME = "Guardians of Ganja";
const YEAR      = new Date().getFullYear();

export function brandedHtml({ preheader = "", body = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width:600px){
      .email-wrap{padding:16px!important}
      .email-card{border-radius:12px!important}
      .email-body{padding:28px 24px!important}
      .email-header{padding:28px 24px!important}
      .email-footer{padding:20px 24px!important}
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#111e17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#111e17;line-height:1px;">${preheader}&nbsp;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;&#8204;</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrap" style="background:#111e17;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;border:1px solid rgba(47,176,115,0.2);">

          <!-- ── Header ──────────────────────────────────── -->
          <tr>
            <td class="email-header" style="background:#0a1510;padding:36px 48px 28px;text-align:center;border-bottom:1px solid rgba(47,176,115,0.15);">
              <img src="${LOGO_URL}" alt="Guardians of Ganja" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;border:0;" />
              <div style="height:2px;background:linear-gradient(90deg,transparent,#2fb073,transparent);margin-top:22px;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- ── Body ───────────────────────────────────── -->
          <tr>
            <td class="email-body" style="background:#0e1c14;padding:40px 48px;">
              <div style="color:#d4e8dc;font-size:15px;line-height:1.75;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- ── Footer ─────────────────────────────────── -->
          <tr>
            <td class="email-footer" style="background:#081008;padding:24px 48px;text-align:center;border-top:1px solid rgba(47,176,115,0.1);">
              <p style="margin:0 0 6px;color:#4a7a5a;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${FROM_NAME}</p>
              <p style="margin:0 0 10px;color:#3a5a45;font-size:12px;">Cannabis Insurance Solutions</p>
              <p style="margin:0 0 14px;">
                <a href="${SITE_URL}" style="color:#2fb073;text-decoration:none;font-size:12px;">${SITE_URL.replace("https://","")}</a>
                <span style="color:#2a4a35;font-size:12px;">&nbsp;&middot;&nbsp;</span>
                <a href="mailto:info@guardiansofganja.com" style="color:#3a6a4a;text-decoration:none;font-size:12px;">info@guardiansofganja.com</a>
              </p>
              <p style="margin:0;color:#2a4030;font-size:11px;">&copy; ${YEAR} ${FROM_NAME}. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// Reusable styled button
export function emailBtn(url, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px;">
    <tr>
      <td align="center" style="background:#2fb073;border-radius:10px;">
        <a href="${url}" style="display:inline-block;padding:14px 36px;background:#2fb073;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.02em;border-radius:10px;mso-padding-alt:14px 36px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// Divider line
export const emailDivider = `<div style="height:1px;background:rgba(47,176,115,0.15);margin:28px 0;"></div>`;

// Muted small text
export function emailMuted(text) {
  return `<p style="color:#4a7a5a;font-size:12px;line-height:1.6;margin:16px 0 0;">${text}</p>`;
}
