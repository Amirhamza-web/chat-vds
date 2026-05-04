import { useState } from 'react';
import clsx from 'clsx';
import type { MessageDto } from '../features/messages/types';
import { addReaction, removeReaction, pinMessage, unpinMessage } from '../features/messages/api';
import { useAuthStore } from '../lib/store';

interface Props {
  message: MessageDto;
  compact: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F525}', '\u{1F44F}'];
const USER_MENTION_RE = /<@([a-z0-9]{8,32})>/g;
const ROLE_MENTION_RE = /<@&([a-z0-9]{8,32})>/g;
const EVERYONE_RE = /(@everyone)/g;

function renderContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const combined = new RegExp(`${USER_MENTION_RE.source}|${ROLE_MENTION_RE.source}|${EVERYONE_RE.source}`, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = combined.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    if (match[1]) {
      parts.push(<span key={match.index} className="bg-accent/20 text-accent rounded px-0.5">@user</span>);
    } else if (match[2]) {
      parts.push(<span key={match.index} className="bg-accent/20 text-accent rounded px-0.5">@role</span>);
    } else if (match[3]) {
      parts.push(<span key={match.index} className="bg-yellow-500/20 text-yellow-500 rounded px-0.5">@everyone</span>);
    }
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts.length ? parts : [content];
}

export default function MessageItem({ message, compact }: Props) {
  const me = useAuthStore((s) => s.user);
  const [showActions, setShowActions] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const initial =
    message.author.displayName?.[0]?.toUpperCase() ??
    message.author.username[0]?.toUpperCase() ??
    '?';

  async function toggleReaction(emoji: string) {
    if (!me) return;
    const existing = message.reactions.find(
      (r) => r.emoji === emoji && r.userIds.includes(me.id),
    );
    if (existing) {
      await removeReaction(message.id, emoji).catch(() => {});
    } else {
      await addReaction(message.id, emoji).catch(() => {});
    }
  }

  async function togglePin() {
    if (message.pinned) {
      await unpinMessage(message.id).catch(() => {});
    } else {
      await pinMessage(message.id).catch(() => {});
    }
  }

  return (
    <div
      className={clsx(
        'group hover:bg-surface-subtle px-4 flex gap-3 transition-colors relative',
        compact ? 'py-0.5' : 'py-2',
        message.mentionsEveryone && 'border-l-2 border-yellow-500/50',
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setEmojiPickerOpen(false);
      }}
    >
      <div className="w-10 flex justify-center pt-1">
        {compact ? (
          <span className="text-[10px] text-ink-muted opacity-0 group-hover:opacity-100">
            {formatTime(message.createdAt)}
          </span>
        ) : (
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-semibold">
            {initial}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-ink-primary">{message.author.displayName}</span>
            <span className="text-xs text-ink-muted" title={formatDateTime(message.createdAt)}>
              {formatTime(message.createdAt)}
            </span>
            {message.pinned && (
              <span className="text-xs text-yellow-500" title="Закреплено">📌</span>
            )}
          </div>
        )}
        {message.content && (
          <div className="text-ink-primary whitespace-pre-wrap break-words">
            {renderContent(message.content)}
            {message.editedAt && (
              <span className="text-xs text-ink-muted ml-1">(изменено)</span>
            )}
          </div>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <Attachment key={a.id} url={a.url} filename={a.filename} mimeType={a.mimeType} />
            ))}
          </div>
        )}
        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const reacted = me ? r.userIds.includes(me.id) : false;
              return (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(r.emoji)}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition',
                    reacted
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface-subtle border-line text-ink-secondary hover:border-accent',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {showActions && (
        <div className="absolute top-0 right-4 -translate-y-1/2 flex bg-surface-card border border-line rounded-md shadow-sm overflow-hidden text-xs">
          <div className="relative">
            <button
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              className="px-2 py-1 text-ink-muted hover:bg-surface-subtle hover:text-accent"
              title="Реакция"
            >
              😊
            </button>
            {emojiPickerOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-card border border-line rounded-md shadow-pop p-1 flex gap-0.5 z-50">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      toggleReaction(e);
                      setEmojiPickerOpen(false);
                    }}
                    className="px-1.5 py-0.5 hover:bg-surface-subtle rounded text-base"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={togglePin}
            className="px-2 py-1 text-ink-muted hover:bg-surface-subtle hover:text-accent"
            title={message.pinned ? 'Открепить' : 'Закрепить'}
          >
            📌
          </button>
        </div>
      )}
    </div>
  );
}

function Attachment({
  url,
  filename,
  mimeType,
}: {
  url: string;
  filename: string;
  mimeType: string;
}) {
  if (mimeType.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-md">
        <img
          src={url}
          alt={filename}
          className="rounded-lg max-h-80 object-cover border border-line"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="bg-surface-subtle border border-line px-3 py-2 rounded-md inline-flex items-center gap-2 text-sm text-ink-secondary hover:border-accent hover:text-accent transition"
    >
      📎 {filename}
    </a>
  );
}
