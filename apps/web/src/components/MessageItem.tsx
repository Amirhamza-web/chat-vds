import clsx from 'clsx';
import type { MessageDto } from '../features/messages/types';

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

export default function MessageItem({ message, compact }: Props) {
  const initial =
    message.author.displayName?.[0]?.toUpperCase() ??
    message.author.username[0]?.toUpperCase() ??
    '?';
  return (
    <div
      className={clsx(
        'group hover:bg-surface-subtle px-4 flex gap-3 transition-colors',
        compact ? 'py-0.5' : 'py-2',
      )}
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
            <span
              className="text-xs text-ink-muted"
              title={formatDateTime(message.createdAt)}
            >
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        {message.content && (
          <div className="text-ink-primary whitespace-pre-wrap break-words">
            {message.content}
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
      </div>
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
