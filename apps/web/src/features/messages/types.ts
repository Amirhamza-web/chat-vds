export interface AttachmentDto {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
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
  attachments: AttachmentDto[];
}
