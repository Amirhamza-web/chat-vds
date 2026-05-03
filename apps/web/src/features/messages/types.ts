export interface AttachmentDto {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface ReactionSummaryDto {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface MentionDto {
  type: 'USER' | 'ROLE';
  userId: string | null;
  roleId: string | null;
}

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  mentionsEveryone: boolean;
  attachments: AttachmentDto[];
  reactions: ReactionSummaryDto[];
  mentions: MentionDto[];
}
