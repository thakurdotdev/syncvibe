import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

interface TOTPSecretResult {
  secret: string;
  qrCode: string;
}

export const generateTOTPSecret = async (email: string): Promise<TOTPSecretResult> => {
  const secret = speakeasy.generateSecret({
    name: `SyncVibe (${email})`,
    length: 20,
  });
  const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
  return { secret: secret.base32, qrCode };
};

export const verifyTOTP = (secret: string, token: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
};
