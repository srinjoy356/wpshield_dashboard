import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  return crypto.scryptSync(key, 'salt', 32);
}

export function encryptString(text: string): string {
  if (!text) return text;
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptString(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts     = text.split(':');
    const iv            = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher      = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted       = decipher.update(encryptedText);
    decrypted           = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    console.error('Failed to decrypt string');
    return text;
  }
}