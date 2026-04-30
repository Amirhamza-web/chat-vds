import crypto from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { prisma } from '../db/prisma.js';

const env = loadEnv();

export interface AccessTokenPayload {
  sub: string; // userId
  username: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function ttlToSec(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 60 * 15;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create an access JWT signed with HS256. We avoid extra deps by inlining a small JWT impl.
 */
export function signAccessToken(payload: AccessTokenPayload): { token: string; exp: number } {
  const ttl = ttlToSec(env.JWT_ACCESS_TTL);
  const exp = nowSec() + ttl;
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: nowSec(), exp };
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const data = `${enc(header)}.${enc(body)}`;
  const sig = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return { token: `${data}.${sig}`, exp };
}

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
  // Constant-time compare
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
  if (payload.exp < nowSec()) return null;
  return { sub: payload.sub, username: payload.username };
}

export async function issueRefreshToken(userId: string): Promise<{ token: string; exp: number }> {
  const raw = crypto.randomBytes(48).toString('base64url');
  const tokenHash = sha256(raw);
  const expSec = nowSec() + env.JWT_REFRESH_TTL_DAYS * 86400;
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(expSec * 1000),
    },
  });
  return { token: raw, exp: expSec };
}

export async function rotateRefreshToken(rawToken: string): Promise<{
  userId: string;
  newToken: string;
  exp: number;
} | null> {
  const tokenHash = sha256(rawToken);
  const found = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!found || found.revokedAt || found.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({
    where: { id: found.id },
    data: { revokedAt: new Date() },
  });
  const next = await issueRefreshToken(found.userId);
  return { userId: found.userId, newToken: next.token, exp: next.exp };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = sha256(rawToken);
  await prisma.refreshToken
    .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function buildTokenPair(user: { id: string; username: string }): Promise<TokenPair> {
  const access = signAccessToken({ sub: user.id, username: user.username });
  const refresh = await issueRefreshToken(user.id);
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.exp,
    refreshExpiresAt: refresh.exp,
  };
}
