-- CreateEnum
CREATE TYPE "DMKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "OverwriteType" AS ENUM ('ROLE', 'MEMBER');

-- CreateEnum
CREATE TYPE "MentionType" AS ENUM ('USER', 'ROLE');

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "dmKind" "DMKind",
ADD COLUMN     "dmOwnerId" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "mentionsEveryone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "isEveryone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "permission_overwrites" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "OverwriteType" NOT NULL,
    "roleId" TEXT,
    "userId" TEXT,
    "allow" TEXT NOT NULL DEFAULT '0',
    "deny" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "permission_overwrites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" "MentionType" NOT NULL,
    "userId" TEXT,
    "roleId" TEXT,

    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_recipients" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dm_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_overwrites_channelId_idx" ON "permission_overwrites"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_overwrites_channelId_roleId_key" ON "permission_overwrites"("channelId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_overwrites_channelId_userId_key" ON "permission_overwrites"("channelId", "userId");

-- CreateIndex
CREATE INDEX "reactions_messageId_idx" ON "reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_messageId_userId_emoji_key" ON "reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "message_mentions_messageId_idx" ON "message_mentions"("messageId");

-- CreateIndex
CREATE INDEX "message_mentions_userId_idx" ON "message_mentions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "dm_recipients_userId_idx" ON "dm_recipients"("userId");

-- CreateIndex
CREATE INDEX "dm_recipients_channelId_idx" ON "dm_recipients"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "dm_recipients_channelId_userId_key" ON "dm_recipients"("channelId", "userId");

-- CreateIndex
CREATE INDEX "messages_channelId_pinned_idx" ON "messages"("channelId", "pinned");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overwrites" ADD CONSTRAINT "permission_overwrites_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overwrites" ADD CONSTRAINT "permission_overwrites_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overwrites" ADD CONSTRAINT "permission_overwrites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_recipients" ADD CONSTRAINT "dm_recipients_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_recipients" ADD CONSTRAINT "dm_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mark existing @everyone roles created in Phase 1.
UPDATE "roles" SET "isEveryone" = TRUE WHERE "name" = '@everyone';
