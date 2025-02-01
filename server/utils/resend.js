const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const FromEmail = `SyncVibe <${
  process.env.RESEND_EMAIL ?? "noreply@syncvibe.xyz"
}>`;

const logoUrl =
  "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp";

const baseEmailStyle = `
    :root {
        color-scheme: light dark;
    }
    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #1a1a1a;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
    }
    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 40px 20px;
    }
    .logo {
        text-align: center;
        margin-bottom: 40px;
    }
    .logo h1 {
        font-size: 28px;
        font-weight: 800;
        color: #000000;
        margin: 0;
        letter-spacing: -0.5px;
    }
    .card {
        background: #ffffff;
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin: 20px 0;
        border: 1px solid #e0e0e0;
        transition: all 0.3s ease;
    }
    .card:hover {
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
    }
    .heading {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 16px 0;
        color: #191919;
        letter-spacing: -0.5px;
    }
    .text {
        font-size: 15px;
        color: #000000;
        margin: 12px 0;
        line-height: 1.6;
    }
    .verification-code {
        color: #000000;
        padding: 16px 32px;
        font-size: 32px;
        font-weight: 600;
        border-radius: 12px;
        margin: 24px 0;
        text-align: center;
        letter-spacing: 6px;
        font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .button {
        display: inline-block;
        padding: 12px 32px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
        margin: 20px 0;
        font-size: 14px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
    }
    .social-links {
        text-align: center;
    }
    .social-links a {
        color: #666666;
        text-decoration: none;
        font-size: 14px;
        margin-right: 10px;
    }
    .social-links a:hover {
        color: #000000;
    }
    .divider {
        border-top: 1px solid #e0e0e0;
        margin: 32px 0;
    }
    .footer {
        text-align: center;
        color: #666666;
        font-size: 13px;
    }
    .list {
        padding-left: 20px;
        margin: 16px 0;
    }
    .list li {
        color: #666666;
        margin: 8px 0;
        font-size: 15px;
    }
    @media (prefers-color-scheme: dark) {
        body {
            background-color: #121212;
            color: #e0e0e0;
        }
        .card {
            background-color: #1e1e1e;
            border-color: #333333;
        }
        .logo h1, .heading {
            color: #ffffff;
        }
        .text {
            color: #b0b0b0;
        }
        .verification-code {
            background: linear-gradient(135deg, #434343 0%, #000000 100%);
        }
    }
    @media (max-width: 600px) {
        .container {
            padding: 20px 10px;
        }
        .card {
            padding: 24px 16px;
        }
        .verification-code {
            font-size: 24px;
            padding: 12px 24px;
            letter-spacing: 4px;
        }
        .social-links {
            flex-direction: column;
            align-items: center;
        }
        .social-links a {
            margin: 10px 0;
        }
    }
`;

const newFeatureTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Features on SyncVibe! 🚀</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #1a1a1a;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px 20px;
        }
        .logo {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo img {
            height: 40px;
        }
        .hero {
            text-align: center;
            padding: 40px 0;
            background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
            color: white;
            border-radius: 16px;
            margin-bottom: 40px;
        }
        .hero h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 16px 0;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            margin: 32px 0;
        }
        .feature-card {
            background: #f8f9fa;
            border-radius: 16px;
            padding: 24px;
            transition: transform 0.2s;
            border: 1px solid #eef0f2;
        }
        .feature-card:hover {
            transform: translateY(-2px);
        }
        .feature-image {
            width: 100%;
            border-radius: 12px;
            margin-bottom: 16px;
        }
        .feature-title {
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: #1a1a1a;
        }
        .button {
            display: inline-block;
            padding: 16px 32px;
            background-color: #1a1a1a;
            color: white;
            text-decoration: none;
            border-radius: 30px;
            font-weight: 600;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .button:hover {
            background-color: #333;
        }
        .social-links {
            text-align: center;
            margin: 40px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 12px;
            color: #1a1a1a;
            text-decoration: none;
            font-weight: 500;
        }
        .footer {
            text-align: center;
            padding: 40px 0;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eef0f2;
        }
        .divider {
            height: 1px;
            background: #eef0f2;
            margin: 32px 0;
        }
        @media (max-width: 600px) {
            .container {
                padding: 20px;
            }
            .hero {
                padding: 32px 16px;
            }
            .feature-card {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <!-- Replace with your actual logo -->
            <h1 style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SyncVibe</h1>
        </div>

        <div class="hero">
            <h1>Level Up Your Social Experience 🚀</h1>
            <p>We've added powerful new features to make SyncVibe even better</p>
        </div>

        <div class="feature-grid">
            <div class="feature-card">
                <img src="/api/placeholder/400/200" alt="Secure login with passkeys" class="feature-image">
                <h3 class="feature-title">🔐 Login Made Simple with Passkeys</h3>
                <p>Say goodbye to passwords! Now you can sign in securely with just your fingerprint or face ID.</p>
            </div>

            <div class="feature-card">
                <img src="/api/placeholder/400/200" alt="Crystal clear video calls" class="feature-image">
                <h3 class="feature-title">🎥 Crystal Clear Video Calls</h3>
                <p>Connect face-to-face with friends and family in stunning HD quality. Share moments as if you're in the same room.</p>
            </div>

            <div class="feature-card">
                <img src="/api/placeholder/400/200" alt="Story posts feature" class="feature-image">
                <h3 class="feature-title">✨ Introducing Story Posts</h3>
                <p>Share your day's highlights with immersive stories. Add music, stickers, and effects to make them pop!</p>
            </div>

            <div class="feature-card">
                <img src="/api/placeholder/400/200" alt="Dark mode" class="feature-image">
                <h3 class="feature-title">🌓 Sleek New Dark Mode</h3>
                <p>Easy on the eyes, easier on your battery. Switch seamlessly between light and dark themes.</p>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="https://syncvibe.xyz" class="button">Try These Features Now</a>
        </div>

        <div class="divider"></div>

        <div class="social-links">
            <a href="https://twitter.com/thakurdotdev">Twitter</a>
            <a href="https://instagram.com/thakurdotdev">Instagram</a>
            <a href="https://github.com/thakurdotdev">GitHub</a>
        </div>

        <div class="footer">
            <p>Built with ❤️ by Pankaj Thakur</p>
            <p>© 2024 SyncVibe. All rights reserved.</p>
            <p><small>You're receiving this because you're part of the SyncVibe community.</p>
        </div>
    </div>
</body>
</html>`;

const resendOtp = async (email, otp) => {
  const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${baseEmailStyle}</style>
</head>
<body>
    <div class="container">
        <div class="card">
        <div class="logo">
            <img src="${logoUrl}" height="50px" width="50px" alt="SyncVibe Logo" style="margin-bottom: 20px;">
        </div>
            <h1 class="heading">Verify your email address</h1>
            <p class="text">Enter this verification code to continue:</p>
            
            <div class="verification-code">${otp}</div>
            
            <p class="text">This code will expire in 1 hour. If you didn't request this code, you can safely ignore this email.</p>
        </div>

         <div class="footer">
            <div class="social-links">
                <a href="https://twitter.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/thakurdotdev" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class="divider"></div>
            <p>Crafted with ❤️ by Pankaj Thakur</p>
        </div>
    </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FromEmail,
    to: [email],
    subject: "Verify your email address",
    html: emailContent,
  });

  if (error) {
    throw {
      status: 500,
      message: "Error sending verification code",
      code: "EMAIL_ERROR",
    };
  }

  return data;
};

const verifiedMailSender = async (email, username) => {
  const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${baseEmailStyle}</style>
</head>
<body>
    <div class="container">
        
        
        <div class="card">
         <div class="logo">
            <img src="${logoUrl}" height="50px" width="50px" alt="SyncVibe Logo" style="margin-bottom: 20px;">
        </div>
            <h1 class="heading">Welcome to SyncVibe</h1>
            <p class="text">Hi ${username}, your account has been verified successfully.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://syncvibe.xyz/login" class="button">Get Started →</a>
            </div>
            
            <div class="divider"></div>
            
            <p class="text">Next steps:</p>
            <ul class="list">
                <li>Complete your profile</li>
                <li>Find and connect with friends</li>
                <li>Share your first post</li>
                <li>Explore trending content</li>
            </ul>
        </div>

         <div class="footer">
            <div class="social-links">
                <a href="https://twitter.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/thakurdotdev" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class="divider"></div>
            <p>Crafted with ❤️ by Pankaj Thakur</p>
        </div>
    </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FromEmail,
    to: [email],
    subject: "Welcome to SyncVibe",
    html: emailContent,
  });

  if (error) {
    throw {
      status: 500,
      message: "Error sending welcome email",
      code: "EMAIL_ERROR",
    };
  }

  return data;
};

const passwordResetMailSender = async (email, resetUrl) => {
  const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${baseEmailStyle}</style>
</head>
<body>
    <div class="container">
         
        
        <div class="card">
        <div class="logo">
            <img src="${logoUrl}" height="50px" width="50px" alt="SyncVibe Logo" style="margin-bottom: 20px;">
            <h1>SyncVibe</h1>
        </div>
            <h1 class="heading">Reset your password</h1>
            <p class="text">Click the button below to reset your password. If you didn't request this, you can safely ignore this email.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" class="button">Reset Password →</a>
            </div>
            
            <p class="text">This link will expire in 1 hour for security reasons.</p>
            
            <div class="divider"></div>
            
            <p class="text" style="font-size: 13px;">If the button doesn't work, copy and paste this URL into your browser:<br>
            <span style="color: #000;">${resetUrl}</span></p>
        </div>

         <div class="footer">
            <div class="social-links">
                <a href="https://twitter.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/thakurdotdev" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class="divider"></div>
            <p>Crafted with ❤️ by Pankaj Thakur</p>
        </div>
    </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FromEmail,
    to: [email],
    subject: "Reset your SyncVibe password",
    html: emailContent,
  });

  if (error) {
    throw {
      status: 500,
      message: "Error sending password reset email",
      code: "EMAIL_ERROR",
    };
  }

  return data;
};

const otpForDeleteMailSender = async (email, otp) => {
  const emailContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <title>Account Deletion Verification</title>
    <style>${baseEmailStyle}</style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@500;600&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="card">
        <div class="logo">
            <img src="${logoUrl}" height="50px" width="50px" alt="SyncVibe Logo" style="margin-bottom: 20px;">
        </div>
            <h1 class="heading">Delete Your Account</h1>
            <p class="text">We received a request to delete your account. To proceed, please use the verification code below:</p>

            <div class="verification-code">${otp}</div>

            <p class="text">This verification code is valid for 10 minutes. If you did not initiate this request, we recommend changing your password immediately and contacting our support team.</p>
        </div>

        <div class="footer">
            <div class="social-links">
                <a href="https://twitter.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/thakurdotdev" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class="divider"></div>
            <p>Crafted with ❤️ by Pankaj Thakur</p>
        </div>
    </div>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: FromEmail,
      to: [email],
      subject: "Verify Account Deletion Request",
      html: emailContent,
    });

    if (error) {
      throw new Error(
        JSON.stringify({
          status: 500,
          message: "Error sending verification code",
          code: "EMAIL_ERROR",
          details: error,
        }),
      );
    }

    return data;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

const accountDeletedMailSender = async (email) => {
  const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${baseEmailStyle}</style>
</head>
<body>
    <div class="container">
         
        
        <div class="card">
        <div class="logo">
            <img src="${logoUrl}" height="50px" width="50px" alt="SyncVibe Logo" style="margin-bottom: 20px;">
        </div>
            <h1 class="heading">Account deleted</h1>
            <p class="text">Your SyncVibe account has been successfully deleted.</p>

            <p class="text">If you didn't request this, please contact us immediately.</p>
        </div>

       <div class="footer">
            <div class="social-links">
                <a href="https://twitter.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/thakurdotdev" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://github.com/thakurdotdev" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div class="divider"></div>
            <p>Crafted with ❤️ by Pankaj Thakur</p>
        </div>
    </div>
</body>

</html>`;
  const { data, error } = await resend.emails.send({
    from: FromEmail,
    to: [email],
    subject: "Account deleted",
    html: emailContent,
  });

  if (error) {
    throw {
      status: 500,
      message: "Error sending account deleted email",
      code: "EMAIL_ERROR",
    };
  }

  return data;
};

module.exports = {
  resendOtp,
  verifiedMailSender,
  passwordResetMailSender,
  otpForDeleteMailSender,
  accountDeletedMailSender,
};
