import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc' as const;

export const encrypt = (text: string): string => {
  const cipher = crypto.createCipheriv(
    algorithm,
    process.env.ENCRYPTION_KEY,
    process.env.ENCRYPTION_IV
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

export const decrypt = (encryptedText: string): string => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    process.env.ENCRYPTION_KEY,
    process.env.ENCRYPTION_IV
  );
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
