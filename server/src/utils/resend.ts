import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = `SyncVibe <${process.env.RESEND_EMAIL ?? 'noreply@thakur.dev'}>`;
const LOGO_URL =
  'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg';
const APP_URL = 'https://syncvibe.thakur.dev';
const CURRENT_YEAR = new Date().getFullYear();

const BRAND = {
  black: '#000000',
  text: '#111111',
  bodyText: '#444444',
  muted: '#666666',
  subtle: '#888888',
  border: '#EAEAEA',
  bg: '#FAFAFA',
  cardBg: '#FFFFFF',
  codeBg: '#F4F4F5',
  codeText: '#000000',
  accent: '#000000',
  accentText: '#FFFFFF',
} as const;

const inlineStyles = {
  body: `margin:0;padding:0;background-color:${BRAND.bg};font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;`,
  wrapper: `width:100%;background-color:${BRAND.bg};padding:48px 0;`,
  container: `max-width:520px;margin:0 auto;padding:0 16px;`,
  card: `background-color:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.02);`,
  cardInner: `padding:40px 36px 36px;`,
  logoRow: `margin-bottom:28px;`,
  logoImg: `height:36px;width:36px;border-radius:50%;vertical-align:middle;`,
  brandName: `font-size:16px;font-weight:600;color:${BRAND.text};letter-spacing:-0.4px;margin-left:10px;vertical-align:middle;display:inline-block;`,
  heading: `font-size:20px;font-weight:600;color:${BRAND.text};margin:0 0 12px;line-height:1.3;letter-spacing:-0.4px;`,
  text: `font-size:14px;line-height:1.6;color:${BRAND.bodyText};margin:0 0 16px;`,
  code: `display:block;text-align:center;background-color:${BRAND.codeBg};border:1px solid ${BRAND.border};border-radius:8px;padding:18px 24px;margin:24px 0;font-family:'Geist Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:${BRAND.codeText};`,
  button: `display:inline-block;background-color:${BRAND.accent};color:${BRAND.accentText};text-decoration:none;border-radius:6px;padding:11px 22px;font-size:13px;font-weight:500;line-height:1;letter-spacing:-0.1px;`,
  buttonWrapper: `text-align:left;padding:16px 0 8px;`,
  divider: `border:none;border-top:1px solid ${BRAND.border};margin:28px 0;`,
  footer: `padding:24px 36px;background-color:${BRAND.bg};border-top:1px solid ${BRAND.border};`,
  footerText: `font-size:12px;line-height:1.6;color:${BRAND.subtle};margin:0;`,
  footerLink: `color:${BRAND.muted};text-decoration:none;font-weight:500;`,
  urlFallback: `font-size:12px;line-height:1.5;color:${BRAND.subtle};margin:0;word-break:break-all;`,
  listItem: `font-size:14px;line-height:1.7;color:${BRAND.bodyText};margin-bottom:6px;`,
  badge: `display:inline-block;background-color:${BRAND.codeBg};border:1px solid ${BRAND.border};border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;color:${BRAND.text};letter-spacing:-0.2px;`,
} as const;

const renderLayout = (content: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>SyncVibe</title>
</head>
<body style="${inlineStyles.body}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${inlineStyles.wrapper}">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="${inlineStyles.container}">
<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${inlineStyles.card}">
    <tr><td style="${inlineStyles.cardInner}">
      <div style="${inlineStyles.logoRow}">
        <img src="${LOGO_URL}" alt="SyncVibe" style="${inlineStyles.logoImg}">
        <span style="${inlineStyles.brandName}">SyncVibe</span>
      </div>
      ${content}
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="${inlineStyles.footer}">
          <p style="${inlineStyles.footerText}">
            <a href="https://twitter.com/thakurdotdev" style="${inlineStyles.footerLink}">Twitter</a> &nbsp;·&nbsp; <a href="https://github.com/thakurdotdev" style="${inlineStyles.footerLink}">GitHub</a> &nbsp;·&nbsp; <a href="https://instagram.com/thakurdotdev" style="${inlineStyles.footerLink}">Instagram</a>
          </p>
          <p style="${inlineStyles.footerText};margin-top:12px;">
            © ${CURRENT_YEAR} SyncVibe. Built by Pankaj Thakur.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const renderVerificationCode = (code: string | number): string =>
  `<div style="${inlineStyles.code}">${code}</div>`;

const renderButton = (text: string, href: string): string =>
  `<div style="${inlineStyles.buttonWrapper}"><a href="${href}" target="_blank" style="${inlineStyles.button}">${text}</a></div>`;

const renderText = (str: string, extraStyle = ''): string =>
  `<p style="${inlineStyles.text}${extraStyle}">${str}</p>`;

const renderHeading = (str: string): string => `<h1 style="${inlineStyles.heading}">${str}</h1>`;

const renderDivider = (): string => `<hr style="${inlineStyles.divider}">`;

interface SendEmailResult {
  id: string;
}

const sendEmail = async (to: string, subject: string, html: string): Promise<SendEmailResult> => {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw Object.assign(new Error(`Error sending email: ${subject}`), {
      statusCode: 500,
      code: 'EMAIL_ERROR',
      details: error,
    });
  }

  return data as SendEmailResult;
};

export const resendOtp = async (email: string, otp: string | number): Promise<SendEmailResult> => {
  const html = renderLayout(
    [
      renderHeading('Verify your email address'),
      renderText('Use the verification code below to complete signing in to SyncVibe.'),
      renderVerificationCode(otp),
      renderText(
        'This code will expire in 1 hour. If you did not request this code, no further action is required.'
      ),
    ].join('')
  );

  return sendEmail(email, 'Verify your email - SyncVibe', html);
};

export const verifiedMailSender = async (
  email: string,
  username: string
): Promise<SendEmailResult> => {
  const html = renderLayout(
    [
      renderHeading('Welcome to SyncVibe'),
      renderText(`Hi ${username}, your email address has been successfully verified.`),
      renderButton('Get Started', `${APP_URL}/login`),
      renderDivider(),
      renderText("What's next:"),
      `<ul style="padding-left:18px;margin:0 0 16px;">
        <li style="${inlineStyles.listItem}">Complete your profile information</li>
        <li style="${inlineStyles.listItem}">Connect with friends and join rooms</li>
        <li style="${inlineStyles.listItem}">Explore trending sessions</li>
      </ul>`,
    ].join('')
  );

  return sendEmail(email, 'Welcome to SyncVibe', html);
};

export const passwordResetMailSender = async (
  email: string,
  resetUrl: string
): Promise<SendEmailResult> => {
  const html = renderLayout(
    [
      renderHeading('Reset your password'),
      renderText(
        'A request was received to reset the password for your SyncVibe account. Click below to continue.'
      ),
      renderButton('Reset Password', resetUrl),
      renderText('This link will expire in 1 hour.'),
      renderDivider(),
      `<p style="${inlineStyles.urlFallback}">If the button doesn't work, copy and paste this URL into your browser:<br><a href="${resetUrl}" style="${inlineStyles.footerLink}">${resetUrl}</a></p>`,
    ].join('')
  );

  return sendEmail(email, 'Reset your SyncVibe password', html);
};

export const otpForDeleteMailSender = async (
  email: string,
  otp: string | number
): Promise<SendEmailResult> => {
  const html = renderLayout(
    [
      renderHeading('Confirm account deletion'),
      renderText('Enter the security code below to confirm deletion of your SyncVibe account.'),
      renderVerificationCode(otp),
      renderText(
        'This code is valid for 10 minutes. If you did not request account deletion, please secure your account immediately.'
      ),
    ].join('')
  );

  return sendEmail(email, 'Confirm account deletion - SyncVibe', html);
};

export const accountDeletedMailSender = async (email: string): Promise<SendEmailResult> => {
  const html = renderLayout(
    [
      renderHeading('Account deleted'),
      renderText(
        'Your SyncVibe account has been permanently deleted along with all associated user data.'
      ),
      renderText('If you believe this was an error, please reach out to support immediately.'),
    ].join('')
  );

  return sendEmail(email, 'Your SyncVibe account has been deleted', html);
};

export interface BuildInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  fileSize?: number;
  sha256?: string;
  platform?: string;
}

export const buildPublishedMailSender = async (
  email: string,
  build: BuildInfo
): Promise<SendEmailResult> => {
  const { version, releaseNotes, downloadUrl, fileSize, sha256, platform = 'Android' } = build;
  const formattedSize = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A';

  const html = renderLayout(
    [
      `<div style="margin-bottom:12px;"><span style="${inlineStyles.badge}">v${version}</span> <span style="font-size:12px;color:${BRAND.subtle};margin-left:6px;">${platform} Build</span></div>`,
      renderHeading(`SyncVibe v${version} Published`),
      renderText(
        `A new ${platform} release (v${version}) has been built, uploaded to Cloudflare R2, and is now ready for deployment.`
      ),
      `<div style="background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px 18px;margin:20px 0;">
        <table style="width:100%;font-size:13px;line-height:1.6;color:${BRAND.text};border-collapse:collapse;">
          <tr>
            <td style="font-weight:600;padding:5px 0;width:110px;color:${BRAND.muted};">Version:</td>
            <td style="font-weight:600;padding:5px 0;color:${BRAND.text};">v${version}</td>
          </tr>
          <tr>
            <td style="font-weight:600;padding:5px 0;color:${BRAND.muted};">Platform:</td>
            <td style="padding:5px 0;color:${BRAND.text};">${platform}</td>
          </tr>
          <tr>
            <td style="font-weight:600;padding:5px 0;color:${BRAND.muted};">Package Size:</td>
            <td style="padding:5px 0;color:${BRAND.text};">${formattedSize}</td>
          </tr>
          ${
            sha256
              ? `<tr>
            <td style="font-weight:600;padding:5px 0;color:${BRAND.muted};">SHA-256:</td>
            <td style="font-family:'Geist Mono',SFMono-Regular,Consolas,monospace;font-size:11px;padding:5px 0;word-break:break-all;color:${BRAND.muted};">${sha256}</td>
          </tr>`
              : ''
          }
          <tr>
            <td style="font-weight:600;padding:5px 0;color:${BRAND.muted};vertical-align:top;">Release Notes:</td>
            <td style="padding:5px 0;white-space:pre-wrap;color:${BRAND.text};">${releaseNotes || 'No release notes provided.'}</td>
          </tr>
        </table>
      </div>`,
      renderButton('Download APK', downloadUrl),
      renderDivider(),
      `<p style="${inlineStyles.urlFallback}">Direct APK Link:<br><a href="${downloadUrl}" style="${inlineStyles.footerLink}">${downloadUrl}</a></p>`,
    ].join('')
  );

  return sendEmail(email, `[SyncVibe] New Build v${version} Published`, html);
};
