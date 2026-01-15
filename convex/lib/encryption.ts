/**
 * Token encryption utilities for Convex
 *
 * Ported from lib/oauth/encryption.ts to work in Convex actions.
 * Uses AES-256-GCM for OAuth token encryption.
 *
 * NOTE: This module uses Node.js crypto and must run in Convex actions
 * (with "use node" directive), not in queries or mutations.
 */

"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Get encryption key from environment
 *
 * @throws Error if OAUTH_TOKEN_ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY environment variable is required"
    );
  }
  return Buffer.from(key, "base64");
}

/**
 * Encrypts a token using AES-256-GCM
 *
 * Returns base64-encoded string containing: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted data
 *
 * @example
 * ```typescript
 * const encrypted = encryptToken(accessToken);
 * await ctx.db.patch(connectionId, { encryptedAccessToken: encrypted });
 * ```
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: IV + AuthTag + EncryptedData
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a token encrypted with encryptToken()
 *
 * @example
 * ```typescript
 * const connection = await ctx.db.get(connectionId);
 * const accessToken = decryptToken(connection.encryptedAccessToken);
 * ```
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedToken, "base64");

  // Extract parts: IV (16 bytes) + AuthTag (16 bytes) + EncryptedData (rest)
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

/**
 * Check if encryption is configured
 *
 * Useful for validation before attempting OAuth operations.
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
}
