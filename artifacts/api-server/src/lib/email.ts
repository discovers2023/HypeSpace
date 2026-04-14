import nodemailer from "nodemailer";

let testAccountPromise: Promise<nodemailer.SentMessageInfo> | null = null;

async function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const fromName = process.env.SMTP_FROM_NAME ?? "HypeSpace";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? (user ?? "noreply@hypespace.app");

  if (host && user && pass) {
    return {
      transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
      from: `"${fromName}" <${fromEmail}>`,
      preview: false,
    };
  }

  // Ethereal test account fallback
  if (!testAccountPromise) {
    testAccountPromise = nodemailer.createTestAccount();
  }
  const account = await testAccountPromise;
  return {
    transporter: nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    }),
    from: `"HypeSpace" <${account.user}>`,
    preview: true,
  };
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  toName: string;
  inviterName: string;
  orgName: string;
  role: string;
  inviteLink: string;
}) {
  const { transporter, from, preview } = await getTransporter();

  const roleLabel = opts.role === "admin" ? "Admin" : opts.role === "manager" ? "Manager" : "Member";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're invited to ${opts.orgName} on HypeSpace</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#F97316,#7C3AED);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">HypeSpace</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Event Management Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#1a0533;font-size:22px;font-weight:700;">You've been invited!</h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                <strong style="color:#1a0533;">${opts.inviterName}</strong> has invited you to join
                <strong style="color:#1a0533;">${opts.orgName}</strong> on HypeSpace as a <strong style="color:#F97316;">${roleLabel}</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf5ff;border:1px solid #e8d5f5;border-radius:8px;margin:0 0 28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Invited as</p>
                    <p style="margin:0;color:#1a0533;font-size:16px;font-weight:600;">${opts.toName}</p>
                    <p style="margin:2px 0 0;color:#888;font-size:14px;">${opts.toEmail}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
                Click the button below to accept your invitation and set up your account.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#F97316,#7C3AED);">
                    <a href="${opts.inviteLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#aaa;font-size:13px;line-height:1.5;">
                This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:12px;">© ${new Date().getFullYear()} HypeSpace. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const info = await transporter.sendMail({
    from,
    to: `"${opts.toName}" <${opts.toEmail}>`,
    subject: `${opts.inviterName} invited you to join ${opts.orgName} on HypeSpace`,
    html,
    text: `You've been invited to join ${opts.orgName} on HypeSpace as ${roleLabel}.\n\nAccept your invitation here: ${opts.inviteLink}\n\nThis link expires in 7 days.`,
  });

  if (preview) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`\n📧  Invite email sent (Ethereal preview):\n    To: ${opts.toEmail}\n    Preview: ${previewUrl}\n`);
  } else {
    console.log(`📧  Invite email sent to ${opts.toEmail} (messageId: ${info.messageId})`);
  }

  return info;
}

/**
 * Generic email sender — used by campaigns, reminders, and test-send.
 * Supports SMTP (Google Workspace, Postmark, etc.) or falls back to Ethereal.
 *
 * To use Google Workspace:
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587
 *   SMTP_USER=you@yourdomain.com  SMTP_PASS=<app-password>
 *
 * To use GHL SMTP (if available):
 *   SMTP_HOST=<ghl-smtp-host>  SMTP_PORT=587
 *   SMTP_USER=<ghl-smtp-user>  SMTP_PASS=<ghl-smtp-pass>
 */
/**
 * Generic email sender — used by campaigns, reminders, and test-send.
 *
 * If `fromOverride` is provided (from a verified sending domain), it
 * overrides the default "from" address so emails arrive from the
 * customer's own domain (e.g. events@anodyneendo.com).
 */
export async function sendEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  fromOverride?: { name: string; email: string };
}): Promise<{ messageId: string; previewUrl?: string | false }> {
  const { transporter, from, preview } = await getTransporter();
  const actualFrom = opts.fromOverride
    ? `"${opts.fromOverride.name}" <${opts.fromOverride.email}>`
    : from;

  const info = await transporter.sendMail({
    from: actualFrom,
    to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  const previewUrl = preview ? nodemailer.getTestMessageUrl(info) : false;

  if (preview && previewUrl) {
    console.log(`\n📧  Email sent (Ethereal preview):\n    To: ${opts.to}\n    Subject: ${opts.subject}\n    Preview: ${previewUrl}\n`);
  } else {
    console.log(`📧  Email sent to ${opts.to} (messageId: ${info.messageId})`);
  }

  return { messageId: info.messageId, previewUrl };
}
