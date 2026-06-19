import crypto from 'crypto';

// Dedicated secret for license-key escrow — deliberately separate from
// MFA_OTP_PEPPER and MFA_COOKIE_SECRET. None of these should ever share a
// secret: each protects a different kind of data, and reusing one secret
// across multiple purposes means a leak of any single env var compromises
// more than one subsystem at once.
function getKey(): Buffer {
  const secret = process.env.LICENSE_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('LICENSE_KEY_ENCRYPTION_SECRET is required');
  // Accept either a 32-byte hex string or any string, hashed down to exactly
  // 32 bytes — AES-256-GCM requires precisely a 32-byte key, and env vars are
  // easy to accidentally set to the wrong length.
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, 'hex');
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a raw license key for recoverable storage (licenses.encrypted_key).
 * Output format: base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)
 * — all three are needed to decrypt, so they travel together as one string
 * rather than as separate columns.
 */
export function encryptLicenseKey(rawKey: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV, the GCM-recommended size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/**
 * Reverses encryptLicenseKey. Throws if the ciphertext was tampered with
 * (GCM's authentication tag check fails) or if the key/format is wrong —
 * callers should treat any thrown error here as "cannot recover this key",
 * not attempt to silently fall back to something insecure.
 */
export function decryptLicenseKey(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted license key');
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}