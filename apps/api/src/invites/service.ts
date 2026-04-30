import type { CreateInviteInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { BadRequest, NotFound } from '../lib/errors.js';
import { assertMember } from '../guilds/service.js';
import { inviteCode } from '../lib/id.js';

export async function createInvite(userId: string, input: CreateInviteInput) {
  await assertMember(userId, input.guildId);
  const code = inviteCode();
  const expiresAt = input.expiresInSec ? new Date(Date.now() + input.expiresInSec * 1000) : null;
  return prisma.invite.create({
    data: {
      code,
      guildId: input.guildId,
      inviterId: userId,
      expiresAt,
      maxUses: input.maxUses ?? null,
    },
  });
}

export async function getInvite(code: string) {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { guild: true },
  });
  if (!invite) throw NotFound('Invite not found');
  if (invite.expiresAt && invite.expiresAt < new Date()) throw BadRequest('Invite expired');
  if (invite.maxUses != null && invite.uses >= invite.maxUses) throw BadRequest('Invite exhausted');
  return invite;
}

export async function acceptInvite(userId: string, code: string) {
  const invite = await getInvite(code);
  await prisma.$transaction(async (tx) => {
    await tx.member
      .create({
        data: { userId, guildId: invite.guildId },
      })
      .catch(() => undefined); // already a member
    await tx.invite.update({ where: { code }, data: { uses: { increment: 1 } } });
  });
  return invite.guild;
}
