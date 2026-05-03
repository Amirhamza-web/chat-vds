import type { LoginInput, RegisterInput } from '@chat-vds/shared';
import { Conflict, Unauthorized } from '../lib/errors.js';
import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword } from './password.js';
import { buildTokenPair, signAccessToken, rotateRefreshToken, revokeRefreshToken, type TokenPair } from './jwt.js';

export async function register(input: RegisterInput): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { id: true, email: true, username: true },
  });
  if (existing) {
    if (existing.email === input.email) throw Conflict('Email already in use');
    throw Conflict('Username already taken');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash,
    },
    select: publicUserSelect,
  });
  const tokens = await buildTokenPair({ id: user.id, username: user.username });
  return { user, tokens };
}

export async function login(input: LoginInput): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  if (!row) throw Unauthorized('Invalid credentials');
  const ok = await verifyPassword(row.passwordHash, input.password);
  if (!ok) throw Unauthorized('Invalid credentials');
  const { passwordHash, ...user } = row;
  void passwordHash;
  const tokens = await buildTokenPair({ id: user.id, username: user.username });
  return { user, tokens };
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) throw Unauthorized('Invalid refresh token');
  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    select: { id: true, username: true },
  });
  if (!user) throw Unauthorized('User not found');
  const access = signAccessToken({ sub: user.id, username: user.username });
  return {
    accessToken: access.token,
    accessExpiresAt: access.exp,
    refreshToken: rotated.newToken,
    refreshExpiresAt: rotated.exp,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}

export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
};
