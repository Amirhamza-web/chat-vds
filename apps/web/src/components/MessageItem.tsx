import clsx from 'clsx';
import type { MessageDto } from '../features/messages/types';

interface Props {
  message: MessageDto;
  compact: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function MessageItem({ message, compact }: Props) {
  const initial =
    message.author.displayName?.[0]?.toUpperCase() ??
    message.author.username[0]?.toUpperCase() ??
    '?';
  return (
    <div
      className={clsx(
        'group hover:bg-bg-600/30 px-4 flex gap-3',
        compact ? 'py-0.5' : 'py-2',
      )}
    >
      <div className="w-10 flex justify-center pt-1">
        {compact ? (
          <span className="text-[10px] text-text-subtle opacity-0 group-hover:opacity-100">
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
            <span className="font-semibold text-white">{message.author.displayName}</span>
            <span
              className="text-xs text-text-subtle"
              title={formatDateTime(message.createdAt)}
            >
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        {message.content && (
          <div className="text-text-primary whitespace-pre-wrap break-words">
            {message.content}
            {message.editedAt && (
              <span className="text-xs text-text-subtle ml-1">(edited)</span>
            )}
          </div>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <Attachment key={a.id} url={a.url} filename={a.filename} mimeType={a.mimeType} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({ url, filename, mimeType }: { url: string; filename: string; mimeType: string }) {
  if (mimeType.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-md">
        <img src={url} alt={filename} className="rounded max-h-80 object-cover" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="bg-bg-800 px-3 py-2 rounded inline-flex items-center gap-2 text-sm hover:underline"
    >
      📎 {filename}
    </a>
  );
}
