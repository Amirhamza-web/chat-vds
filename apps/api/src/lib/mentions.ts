import { prisma } from '../db/prisma.js';

export interface ParsedMentions {
  userIds: string[];
  roleIds: string[];
  everyone: boolean;
}

const USER_MENTION_RE = /<@([a-z0-9]{8,32})>/g;
const ROLE_MENTION_RE = /<@&([a-z0-9]{8,32})>/g;
const EVERYONE_RE = /(?<![a-zA-Z0-9_])@everyone(?![a-zA-Z0-9_])/;

/**
 * Parse mention markup from a message body.
 * - `<@USERID>` for user mentions
 * - `<@&ROLEID>` for role mentions
 * - bare `@everyone` token for the everyone mention
 */
export function parseMentionMarkup(content: string): ParsedMentions {
  const userIds = new Set<string>();
  const roleIds = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = USER_MENTION_RE.exec(content)) !== null) userIds.add(m[1]!);
  while ((m = ROLE_MENTION_RE.exec(content)) !== null) roleIds.add(m[1]!);
  return {
    userIds: [...userIds],
    roleIds: [...roleIds],
    everyone: EVERYONE_RE.test(content),
  };
}

/**
 * Validate the mention ids against the guild context — only members of the
 * guild can be user-mentioned, only roles in the guild can be role-mentioned.
 * For DM channels we just keep user mentions that match recipients.
 */
export async function validateMentionsForChannel(
  channelId: string,
  parsed: ParsedMentions,
): Promise<ParsedMentions> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });
  if (!channel) return { userIds: [], roleIds: [], everyone: false };

  if (channel.guildId) {
    const [members, roles] = await Promise.all([
      parsed.userIds.length
        ? prisma.member.findMany({
            where: { guildId: channel.guildId, userId: { in: parsed.userIds } },
            select: { userId: true },
          })
        : Promise.resolve([]),
      parsed.roleIds.length
        ? prisma.role.findMany({
            where: { guildId: channel.guildId, id: { in: parsed.roleIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      userIds: members.map((m) => m.userId),
      roleIds: roles.map((r) => r.id),
      everyone: parsed.everyone,
    };
  }

  // DM channel: only allow user mentions of channel recipients.
  if (parsed.userIds.length === 0) {
    return { userIds: [], roleIds: [], everyone: false };
  }
  const recipients = await prisma.dMRecipient.findMany({
    where: { channelId, userId: { in: parsed.userIds } },
    select: { userId: true },
  });
  return {
    userIds: recipients.map((r) => r.userId),
    roleIds: [],
    everyone: false,
  };
}

/**
 * Resolve all user ids that should be notified for a mention set, expanding
 * role mentions and `@everyone` to the underlying members. Excludes the author.
 */
export async function expandMentionRecipients(
  channelId: string,
  authorId: string,
  parsed: ParsedMentions,
): Promise<string[]> {
  const recipients = new Set<string>();
  for (const id of parsed.userIds) recipients.add(id);

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });
  if (!channel) return [];

  if (channel.guildId) {
    if (parsed.everyone) {
      const members = await prisma.member.findMany({
        where: { guildId: channel.guildId },
        select: { userId: true },
      });
      for (const m of members) recipients.add(m.userId);
    } else if (parsed.roleIds.length > 0) {
      const members = await prisma.member.findMany({
        where: {
          guildId: channel.guildId,
          roles: { some: { id: { in: parsed.roleIds } } },
        },
        select: { userId: true },
      });
      for (const m of members) recipients.add(m.userId);
    }
  }

  recipients.delete(authorId);
  return [...recipients];
}
