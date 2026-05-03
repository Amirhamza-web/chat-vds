import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMessages, sendMessage, uploadAttachment } from '../features/messages/api';
import type { MessageDto } from '../features/messages/types';
import { getSocket } from '../lib/socket';
import { SocketEvents } from '@chat-vds/shared';
import { useAuthStore } from '../lib/store';
import MessageItem from './MessageItem';

interface Props {
  channelId: string;
  channelName: string;
}

export default function ChatView({ channelId, channelName }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    id: string;
    url: string;
    filename: string;
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => fetchMessages(channelId),
  });

  // Join channel + subscribe
  useEffect(() => {
    const socket = getSocket();
    socket.emit(SocketEvents.ChannelJoin, channelId);

    const onNew = (msg: MessageDto) => {
      if (msg.channelId !== channelId) return;
      qc.setQueryData<MessageDto[]>(['messages', channelId], (cur) => {
        const list = cur ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        return [...list, msg];
      });
    };
    const onUpdate = (msg: MessageDto) => {
      if (msg.channelId !== channelId) return;
      qc.setQueryData<MessageDto[]>(['messages', channelId], (cur) =>
        (cur ?? []).map((m) => (m.id === msg.id ? msg : m)),
      );
    };
    const onDelete = ({ id }: { id: string; channelId: string }) => {
      qc.setQueryData<MessageDto[]>(['messages', channelId], (cur) =>
        (cur ?? []).filter((m) => m.id !== id),
      );
    };
    const onTyping = ({ channelId: chId, userId }: { channelId: string; userId: string }) => {
      if (chId !== channelId) return;
      if (userId === me?.id) return;
      setTypingUsers((cur) => ({ ...cur, [userId]: Date.now() }));
    };

    socket.on(SocketEvents.MessageNew, onNew);
    socket.on(SocketEvents.MessageUpdate, onUpdate);
    socket.on(SocketEvents.MessageDelete, onDelete);
    socket.on(SocketEvents.TypingUpdate, onTyping);

    return () => {
      socket.emit(SocketEvents.ChannelLeave, channelId);
      socket.off(SocketEvents.MessageNew, onNew);
      socket.off(SocketEvents.MessageUpdate, onUpdate);
      socket.off(SocketEvents.MessageDelete, onDelete);
      socket.off(SocketEvents.TypingUpdate, onTyping);
    };
  }, [channelId, qc, me?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Clean up stale typing indicators
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((cur) => {
        const now = Date.now();
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(cur)) if (now - v < 4000) out[k] = v;
        return out;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function send() {
    const content = draft.trim();
    if (!content && !pendingAttachment) return;
    setSending(true);
    try {
      await sendMessage(
        channelId,
        content || pendingAttachment?.filename || '',
        pendingAttachment ? [pendingAttachment.id] : undefined,
      );
      setDraft('');
      setPendingAttachment(null);
    } finally {
      setSending(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const att = await uploadAttachment(file);
      setPendingAttachment({ id: att.id, url: att.url, filename: file.name });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const lastTypingRef = useRef(0);
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    getSocket().emit(SocketEvents.TypingStart, channelId);
  }, [channelId]);

  const typingNames = Object.keys(typingUsers);

  return (
    <>
      <header className="px-5 py-3 border-b border-line bg-surface-card flex items-center gap-2 shrink-0">
        <span className="text-ink-muted">#</span>
        <h2 className="font-semibold text-ink-primary">{channelName}</h2>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto py-4 bg-surface-card">
        {messages.length === 0 && (
          <div className="text-center text-ink-tertiary py-10 text-sm">
            Это начало канала #{channelName}. Напишите первое сообщение!
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const compact =
            prev?.authorId === m.authorId &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          return <MessageItem key={m.id} message={m} compact={compact} />;
        })}
      </div>

      <div className="px-5 pb-1 h-5 text-xs text-ink-muted">
        {typingNames.length > 0 && 'Кто-то печатает…'}
      </div>

      <div className="px-5 pb-4">
        {pendingAttachment && (
          <div className="bg-surface-subtle border border-line px-3 py-2 mb-2 rounded-md flex items-center gap-3 text-sm">
            <span className="text-accent">📎</span>
            <span className="flex-1 truncate text-ink-secondary">{pendingAttachment.filename}</span>
            <button
              onClick={() => setPendingAttachment(null)}
              className="text-ink-muted hover:text-danger"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-end bg-surface-card border border-line rounded-lg focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Прикрепить файл"
            className="px-3 py-3 text-ink-muted hover:text-accent disabled:opacity-50"
          >
            {uploading ? '…' : '📎'}
          </button>
          <input ref={fileInputRef} type="file" hidden onChange={onFile} />
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              emitTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Написать в #${channelName}`}
            rows={1}
            className="flex-1 bg-transparent text-ink-primary placeholder:text-ink-muted resize-none outline-none px-2 py-3 max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || (!draft.trim() && !pendingAttachment)}
            title="Отправить"
            className="px-4 py-3 text-accent hover:text-accent-hover disabled:opacity-30"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
