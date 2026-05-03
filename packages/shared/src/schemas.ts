import { z } from 'zod';
import { ALL_PERMISSION_FLAGS } from './permissions.js';

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

// ───────────────────────── Roles ─────────────────────────

export const PermissionFlagSchema = z.enum(
  ALL_PERMISSION_FLAGS as [string, ...string[]],
);

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.number().int().min(0).max(0xffffff).default(0),
  permissions: z.string().regex(/^\d+$/).default('0'),
});
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  permissions: z.string().regex(/^\d+$/).optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

export const SetMemberRolesSchema = z.object({
  roleIds: z.array(z.string()).max(64),
});
export type SetMemberRolesInput = z.infer<typeof SetMemberRolesSchema>;

// ───────────────────────── Permission overwrites ─────────────────────────

export const OverwriteTypeSchema = z.enum(['ROLE', 'MEMBER']);

export const PutOverwriteSchema = z
  .object({
    type: OverwriteTypeSchema,
    roleId: z.string().optional(),
    userId: z.string().optional(),
    allow: z.string().regex(/^\d+$/).default('0'),
    deny: z.string().regex(/^\d+$/).default('0'),
  })
  .refine(
    (v) =>
      (v.type === 'ROLE' && !!v.roleId && !v.userId) ||
      (v.type === 'MEMBER' && !!v.userId && !v.roleId),
    'roleId required for ROLE overwrite, userId required for MEMBER overwrite',
  );
export type PutOverwriteInput = z.infer<typeof PutOverwriteSchema>;

// ───────────────────────── Reactions ─────────────────────────

// Reasonable cap; we don't want to store arbitrary unicode strings as "emoji".
export const ReactionEmojiSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[^\s]+$/, 'emoji must not contain whitespace');

export const AddReactionSchema = z.object({
  emoji: ReactionEmojiSchema,
});
export type AddReactionInput = z.infer<typeof AddReactionSchema>;

// ───────────────────────── DMs ─────────────────────────

export const OpenDMSchema = z.object({
  recipientId: z.string(),
});
export type OpenDMInput = z.infer<typeof OpenDMSchema>;

export const CreateGroupDMSchema = z.object({
  recipientIds: z.array(z.string()).min(1).max(9),
  name: z.string().min(1).max(100).optional(),
});
export type CreateGroupDMInput = z.infer<typeof CreateGroupDMSchema>;

export const AddDMRecipientSchema = z.object({
  userId: z.string(),
});
export type AddDMRecipientInput = z.infer<typeof AddDMRecipientSchema>;

// ───────────────────────── Search ─────────────────────────

export const MessageSearchSchema = z.object({
  q: z.string().min(1).max(200),
  guildId: z.string().optional(),
  channelId: z.string().optional(),
  authorId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
export type MessageSearchInput = z.infer<typeof MessageSearchSchema>;

// ───────────────────────── Push notifications ─────────────────────────

export const PushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;

export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeSchema>;
