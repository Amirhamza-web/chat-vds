import { z } from 'zod';

// ───────────────────────── Auth ─────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, digits, underscore, dot, dash'),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

// ───────────────────────── Guilds ─────────────────────────

export const CreateGuildSchema = z.object({
  name: z.string().min(2).max(64),
});
export type CreateGuildInput = z.infer<typeof CreateGuildSchema>;

// ───────────────────────── Channels ─────────────────────────

export const ChannelTypeSchema = z.enum(['TEXT', 'VOICE', 'CATEGORY']);
export type ChannelTypeT = z.infer<typeof ChannelTypeSchema>;

export const CreateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, dashes only'),
  type: ChannelTypeSchema,
  topic: z.string().max(1024).optional(),
});
export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;

// ───────────────────────── Messages ─────────────────────────

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  attachmentIds: z.array(z.string()).max(10).optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const EditMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type EditMessageInput = z.infer<typeof EditMessageSchema>;

// ───────────────────────── Invites ─────────────────────────

export const CreateInviteSchema = z.object({
  guildId: z.string(),
  expiresInSec: z.number().int().min(60).max(60 * 60 * 24 * 30).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
});
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
