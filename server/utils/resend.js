const { Resend } = require("resend")

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = `SyncVibe <${process.env.RESEND_EMAIL ?? "noreply@thakur.dev"}>`
const LOGO_URL =
  "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
const APP_URL = "https://syncvibe.thakur.dev"
const CURRENT_YEAR = new Date().getFullYear()

const BRAND = {
  black: "#000000",
  text: "#171717",
  muted: "#6b7280",
  subtle: "#9ca3af",
  border: "#e5e7eb",
  bg: "#fafafa",
  white: "#ffffff",
  accent: "#171717",
  accentText: "#ffffff",
  codeBg: "#f3f4f6",
}

const inlineStyles = {
  body: `margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;`,
  wrapper: `width:100%;background-color:${BRAND.bg};padding:40px 0;`,
  container: `max-width:560px;margin:0 auto;padding:0 20px;`,
  card: `background-color:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;`,
  cardInner: `padding:40px 40px 32px;`,
  logo: `text-align:center;padding-bottom:32px;`,
  logoImg: `height:40px;width:40px;border-radius:50%;`,
  heading: `font-size:22px;font-weight:600;color:${BRAND.text};margin:0 0 12px;line-height:1.3;letter-spacing:-0.3px;`,
  text: `font-size:14px;line-height:1.6;color:${BRAND.muted};margin:0 0 16px;`,
  code: `display:block;text-align:center;background-color:${BRAND.codeBg};border:1px solid ${BRAND.border};border-radius:8px;padding:20px;margin:24px 0;font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.text};`,
  button: `display:inline-block;background-color:${BRAND.accent};color:${BRAND.accentText};text-decoration:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:500;line-height:1;`,
  buttonWrapper: `text-align:center;padding:24px 0 8px;`,
  divider: `border:none;border-top:1px solid ${BRAND.border};margin:24px 0;`,
  footer: `padding:24px 40px;`,
  footerText: `font-size:12px;line-height:1.6;color:${BRAND.subtle};margin:0;text-align:center;`,
  footerLink: `color:${BRAND.subtle};text-decoration:none;`,
  urlFallback: `font-size:12px;line-height:1.5;color:${BRAND.subtle};margin:0;word-break:break-all;`,
  listItem: `font-size:14px;line-height:1.8;color:${BRAND.muted};`,
}

const renderLayout = (content) => `<!DOCTYPE html>
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
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="${inlineStyles.container}">
<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${inlineStyles.card}">
    <tr><td style="${inlineStyles.cardInner}">
      <div style="${inlineStyles.logo}">
        <img src="${LOGO_URL}" alt="SyncVibe" style="${inlineStyles.logoImg}">
      </div>
      ${content}
    </td></tr>
    <tr><td style="border-top:1px solid ${BRAND.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="${inlineStyles.footer}">
          <p style="${inlineStyles.footerText}">
            <a href="https://twitter.com/thakurdotdev" style="${inlineStyles.footerLink}">Twitter</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://instagram.com/thakurdotdev" style="${inlineStyles.footerLink}">Instagram</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://github.com/thakurdotdev" style="${inlineStyles.footerLink}">GitHub</a>
          </p>
          <p style="${inlineStyles.footerText};margin-top:16px;">
            © ${CURRENT_YEAR} SyncVibe · Built by Pankaj Thakur
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
</html>`

const renderVerificationCode = (code) =>
  `<div style="${inlineStyles.code}">${code}</div>`

const renderButton = (text, href) =>
  `<div style="${inlineStyles.buttonWrapper}"><a href="${href}" target="_blank" style="${inlineStyles.button}">${text}</a></div>`

const renderText = (str, extraStyle = "") =>
  `<p style="${inlineStyles.text}${extraStyle}">${str}</p>`

const renderHeading = (str) =>
  `<h1 style="${inlineStyles.heading}">${str}</h1>`

const renderDivider = () =>
  `<hr style="${inlineStyles.divider}">`

const sendEmail = async (to, subject, html) => {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  })

  if (error) {
    throw {
      status: 500,
      message: `Error sending email: ${subject}`,
      code: "EMAIL_ERROR",
      details: error,
    }
  }

  return data
}

const resendOtp = async (email, otp) => {
  const html = renderLayout([
    renderHeading("Verify your email"),
    renderText("Enter this verification code to get started with SyncVibe."),
    renderVerificationCode(otp),
    renderText("This code expires in 1 hour. If you didn't request this, you can safely ignore this email."),
  ].join(""))

  return sendEmail(email, "Your verification code", html)
}

const verifiedMailSender = async (email, username) => {
  const html = renderLayout([
    renderHeading("Welcome to SyncVibe"),
    renderText(`Hi ${username}, your email has been verified. You're all set.`),
    renderButton("Get Started", `${APP_URL}/login`),
    renderDivider(),
    renderText("Here's what you can do next:"),
    `<ul style="padding-left:20px;margin:0 0 16px;">
      <li style="${inlineStyles.listItem}">Complete your profile</li>
      <li style="${inlineStyles.listItem}">Find and connect with friends</li>
      <li style="${inlineStyles.listItem}">Share your first post</li>
      <li style="${inlineStyles.listItem}">Explore trending content</li>
    </ul>`,
  ].join(""))

  return sendEmail(email, "Welcome to SyncVibe", html)
}

const passwordResetMailSender = async (email, resetUrl) => {
  const html = renderLayout([
    renderHeading("Reset your password"),
    renderText("We received a request to reset your password. Click the button below to choose a new one."),
    renderButton("Reset Password", resetUrl),
    renderText("This link expires in 1 hour for security reasons."),
    renderDivider(),
    `<p style="${inlineStyles.urlFallback}">If the button doesn't work, copy and paste this URL into your browser:<br>${resetUrl}</p>`,
  ].join(""))

  return sendEmail(email, "Reset your password", html)
}

const otpForDeleteMailSender = async (email, otp) => {
  const html = renderLayout([
    renderHeading("Confirm account deletion"),
    renderText("We received a request to delete your account. Use the code below to confirm."),
    renderVerificationCode(otp),
    renderText("This code is valid for 10 minutes. If you didn't request this, change your password immediately."),
  ].join(""))

  return sendEmail(email, "Confirm account deletion", html)
}

const accountDeletedMailSender = async (email) => {
  const html = renderLayout([
    renderHeading("Account deleted"),
    renderText("Your SyncVibe account has been permanently deleted. All your data has been removed."),
    renderText("If you didn't request this, please contact us immediately."),
  ].join(""))

  return sendEmail(email, "Your account has been deleted", html)
}

module.exports = {
  resendOtp,
  verifiedMailSender,
  passwordResetMailSender,
  otpForDeleteMailSender,
  accountDeletedMailSender,
}
