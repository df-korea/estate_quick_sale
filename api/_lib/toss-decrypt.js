import crypto from 'crypto';

const IV_LENGTH = 12;

/**
 * Decrypt AES-256-GCM encrypted value from Toss login-me API.
 * Key: base64-encoded 256-bit AES key (TOSS_LOGIN_DECRYPT_KEY env var)
 * AAD: "TOSS" (provided by Toss via email)
 */
export function decryptTossValue(encryptedBase64) {
  const key = process.env.TOSS_LOGIN_DECRYPT_KEY;
  if (!key || !encryptedBase64) return null;

  try {
    const decoded = Buffer.from(encryptedBase64, 'base64');
    const iv = decoded.subarray(0, IV_LENGTH);
    const authTagStart = decoded.length - 16;
    const ciphertext = decoded.subarray(IV_LENGTH, authTagStart);
    const authTag = decoded.subarray(authTagStart);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from('TOSS'));

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    console.error('[toss-decrypt] failed:', e.message);
    return null;
  }
}
