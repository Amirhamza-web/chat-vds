import crypto from 'node:crypto';
import { loadEnv } from './config.js';

const env = loadEnv();

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

/**
 * Verifies an access JWT signed by the API. Mirrors apps/api/src/auth/jwt.ts —
 * we re-implement instead of importing to keep the SFU process self-contained.
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  if (!h || !b || !s) return null;
  const expected = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${h}.${b}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const sBuf = Buffer.from(s);
  const eBuf = Buffer.from(expected);
  if (sBuf.length !== eBuf.length || !crypto.timingSafeEqual(sBuf, eBuf)) return null;
  let payload: { sub?: string; username?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.sub || !payload.username || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { sub: payload.sub, username: payload.username };
}
