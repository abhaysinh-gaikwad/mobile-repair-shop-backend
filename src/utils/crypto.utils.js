import crypto from 'crypto';

import config from '@src/configs/app.config';

/**
 * Encryption for the device unlock credential (screen-lock PIN / password /
 * pattern) captured at intake.
 *
 * This is the ONLY sensitive value the shop stores. It is encrypted at rest so
 * a database dump, a backup file, or a stray SELECT never exposes customers'
 * phone PINs in plain text.
 *
 * AES-256-GCM is used rather than a hash because the value must be READ BACK —
 * the engineer needs to actually unlock the phone to test it. That rules out
 * bcrypt/argon2, which are one-way by design.
 *
 * Stored format:  v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 * The `v1` prefix leaves room to rotate the scheme later without guessing at
 * what an existing row contains.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const PREFIX = 'v1';

/**
 * Derive a stable 32-byte key from the configured secret.
 *
 * scrypt with a fixed salt is deliberate: the key must be reproducible across
 * restarts, and the input secret is already high-entropy config rather than a
 * user-chosen password.
 */
let cachedKey = null;
const getKey = () => {
  if (cachedKey) return cachedKey;
  const secret = config.get('security.deviceSecretKey');
  cachedKey = crypto.scryptSync(secret, 'mobile-repair-shop-device-unlock', 32);
  return cachedKey;
};

/** Encrypt a credential. Returns null for empty input so the column stays NULL. */
export const encryptSecret = (plainText) => {
  if (plainText === null || plainText === undefined || String(plainText).trim() === '') return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt a stored credential.
 *
 * Returns null rather than throwing when the value is missing or unreadable —
 * a corrupted or key-rotated row must not break the repair page; the UI simply
 * shows that no credential is available.
 */
export const decryptSecret = (cipherText) => {
  if (!cipherText) return null;

  try {
    const [version, ivHex, authTagHex, payloadHex] = String(cipherText).split(':');
    if (version !== PREFIX || !ivHex || !authTagHex || !payloadHex) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    return Buffer.concat([decipher.update(Buffer.from(payloadHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

/** Whether a credential exists, without decrypting it. Safe for list responses. */
export const hasSecret = (cipherText) => Boolean(cipherText);
