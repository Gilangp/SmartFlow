import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Finto <onboarding@resend.dev>';
const APP_NAME = 'Finto';
const isDev = process.env.NODE_ENV === 'development';


// ============================================================================
// Dev helper — tampilkan OTP di terminal saat development
// ============================================================================
function logOtpToConsole(purpose: string, email: string, code: string) {
  if (!isDev) return;
  console.log('\n' + '='.repeat(50));
  console.log(`[DEV] OTP ${purpose}`);
  console.log(`  Email : ${email}`);
  console.log(`  Kode  : \x1b[33m\x1b[1m${code}\x1b[0m  <-- gunakan ini`);
  console.log(`  Expire: 5 menit`);
  console.log('='.repeat(50) + '\n');
}

// ============================================================================
// Helper to detect Resend Sandbox restriction
// ============================================================================
function isSandboxError(error: any): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error.message || '';
  return (
    message.includes('own email address') ||
    message.includes('verify a domain') ||
    message.includes('validation_error')
  );
}

// ============================================================================
// Send OTP for Register Verification
// ============================================================================
export async function sendRegisterOtp(email: string, code: string, name: string): Promise<void> {
  // Selalu log ke console
  logOtpToConsole('REGISTER', email, code);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${code} — Kode Verifikasi Finto`,
      html: buildOtpEmail({
        title: 'Verifikasi Email Kamu',
        greeting: `Hai, ${name}! 👋`,
        bodyText: 'Terima kasih sudah mendaftar di Finto. Gunakan kode berikut untuk memverifikasi email kamu:',
        code,
        expiryText: 'Kode ini berlaku selama <strong>5 menit</strong>.',
        footerText: 'Jika kamu tidak mendaftar di Finto, abaikan email ini.',
        purpose: 'REGISTER',
      }),
    });

    if (error) {
      console.error('[Resend] Gagal kirim email register OTP:', error);
      if (isSandboxError(error)) {
        console.warn(`[SANDBOX BYPASS] OTP for ${email} is: ${code} (Check Vercel Logs)`);
        return;
      }
      if (!isDev) throw new Error(error.message);
    }
  } catch (err) {
    console.error('[Resend] Error:', err);
    if (isSandboxError(err)) {
      console.warn(`[SANDBOX BYPASS] OTP for ${email} is: ${code} (Check Vercel Logs)`);
      return;
    }
    if (!isDev) throw err;
  }
}

// ============================================================================
// Send OTP for Password Reset
// ============================================================================
export async function sendResetPasswordOtp(email: string, code: string): Promise<void> {
  // Selalu log ke console
  logOtpToConsole('RESET PASSWORD', email, code);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${code} — Reset Password Finto`,
      html: buildOtpEmail({
        title: 'Reset Password',
        greeting: 'Halo!',
        bodyText: 'Kami menerima permintaan reset password untuk akun Finto kamu. Gunakan kode berikut:',
        code,
        expiryText: 'Kode ini berlaku selama <strong>5 menit</strong>.',
        footerText: 'Jika kamu tidak meminta reset password, abaikan email ini. Akun kamu tetap aman.',
        purpose: 'RESET_PASSWORD',
      }),
    });

    if (error) {
      console.error('[Resend] Gagal kirim email reset password OTP:', error);
      if (isSandboxError(error)) {
        console.warn(`[SANDBOX BYPASS] OTP for ${email} is: ${code} (Check Vercel Logs)`);
        return;
      }
      if (!isDev) throw new Error(error.message);
    }
  } catch (err) {
    console.error('[Resend] Error:', err);
    if (isSandboxError(err)) {
      console.warn(`[SANDBOX BYPASS] OTP for ${email} is: ${code} (Check Vercel Logs)`);
      return;
    }
    if (!isDev) throw err;
  }
}


// ============================================================================
// Email Template Builder
// ============================================================================
interface OtpEmailOptions {
  title: string;
  greeting: string;
  bodyText: string;
  code: string;
  expiryText: string;
  footerText: string;
  purpose: string;
}

function buildOtpEmail(opts: OtpEmailOptions): string {
  const { title, greeting, bodyText, code, expiryText, footerText } = opts;
  const APP_URL = process.env.APP_URL || 'https://finto-finance.vercel.app';
  const LOGO_URL = `${APP_URL}/icon-512x512.png`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <img src="${LOGO_URL}" alt="${APP_NAME}" width="32" height="32"
                      style="width:32px;height:32px;border-radius:7px;display:block;object-fit:cover;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:15px;font-weight:700;color:#1e293b;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;padding:32px 28px;">

              <h2 style="margin:0 0 6px;font-size:17px;font-weight:700;color:#0f172a;">${title}</h2>
              <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${greeting}</p>

              <p style="margin:0 0 22px;font-size:14px;color:#475569;line-height:1.7;">${bodyText}</p>

              <!-- OTP Box -->
              <div style="border-left:3px solid #4f46e5;background:#f8fafc;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;">Kode Verifikasi</p>
                <span style="font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:6px;font-family:'Courier New',monospace;">${code}</span>
              </div>

              <p style="margin:0 0 20px;font-size:13px;color:#64748b;">${expiryText}</p>

              <!-- Security Warning -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px 14px;margin-bottom:20px;">
                <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                  <strong>Jangan bagikan kode ini kepada siapapun.</strong>
                  Tim ${APP_NAME} tidak pernah meminta kode verifikasi kamu. Jika ada yang memintanya, abaikan dan segera amankan akun kamu.
                </p>
              </div>

              <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 16px;" />

              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">${footerText}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:18px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#cbd5e1;">&copy; ${new Date().getFullYear()} ${APP_NAME} &mdash; Student Financial Companion</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
