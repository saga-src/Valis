import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { format } from 'date-fns';
import type { PresenceState } from '../../../context/PresenceContext';
import { cn } from '../../../lib/utils/cn';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { DIRECT_MESSAGE_MAX_LENGTH } from '../services/directMessageService';
import type { ChatFriend } from '../types/chat';
import { useDirectMessageUnread } from '../../../context/DirectMessageUnreadContext';

interface DirectChatProps {
  userId: string;
  friend: ChatFriend;
  presence?: PresenceState;
  isFriend: boolean;
  onOpenProfile: () => void;
}

function formatMessageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'MMM d, HH:mm:ss');
}

export function DirectChat({
  userId,
  friend,
  presence,
  isFriend,
  onOpenProfile,
}: DirectChatProps) {
  const {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    refetch,
  } = useDirectMessages({
    userId,
    friendId: friend.id,
    isFriend,
  });
  const { markConversationRead, setActiveConversation } =
    useDirectMessageUnread();
  const [draft, setDraft] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    setDraft('');
    shouldStickToBottomRef.current = true;
    previousMessageCountRef.current = 0;
  }, [friend.id]);

  useEffect(() => {
    setActiveConversation(friend.id);
    return () => setActiveConversation(null);
  }, [friend.id, setActiveConversation]);

  useEffect(() => {
    const latestReceivedMessage = [...messages]
      .reverse()
      .find((message) => message.receiver_id === userId);

    if (latestReceivedMessage) {
      markConversationRead(friend.id, {
        id: latestReceivedMessage.id,
        created_at: latestReceivedMessage.created_at,
      });
    }
  }, [friend.id, markConversationRead, messages, userId]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || loading || messages.length === 0) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const isInitialHistory = previousMessageCountRef.current === 0;
    const newestMessageIsMine =
      messages.length > previousMessageCountRef.current &&
      messages[messages.length - 1]?.sender_id === userId;

    if (
      isInitialHistory ||
      newestMessageIsMine ||
      shouldStickToBottomRef.current
    ) {
      requestAnimationFrame(() => {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [loading, messages, userId]);

  const handleScroll = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const distanceFromBottom =
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || sending || !isFriend) return;

    const sent = await sendMessage(draft);
    if (sent) {
      setDraft('');
      shouldStickToBottomRef.current = true;
    }
  };

  const presenceLabel =
    presence?.status === 'playing'
      ? `Playing ${presence.game_title || 'a game'}`
      : presence
        ? 'Online'
        : 'Offline';

  return (
    <div className="h-full min-h-0 flex flex-col bg-card/30">
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-border/50 bg-background/50">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 text-left group"
          title={`Open ${friend.username}'s profile`}
        >
          <div className="relative shrink-0">
            <img
              src={
                friend.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`
              }
              alt={friend.username}
              className="w-11 h-11 rounded-full object-cover bg-muted border border-border group-hover:ring-2 ring-primary transition-all"
            />
            <span
              className={cn(
                'absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-card',
                presence?.status === 'playing'
                  ? 'bg-purple-500'
                  : presence
                    ? 'bg-emerald-500'
                    : 'bg-zinc-500',
              )}
            />
          </div>
          <span className="min-w-0">
            <span className="block text-sm font-black truncate group-hover:text-primary transition-colors">
              {friend.username || 'Unknown'}
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground truncate">
              {presenceLabel}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <MessageCircle size={14} className="text-primary" />
          Private chat
        </div>
      </div>

      {error && (
        <div className="shrink-0 m-4 mb-0 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle size={15} className="shrink-0" />
            <span className="truncate">{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Retry conversation"
            aria-label="Retry conversation"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5"
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs">Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4">
              <MessageCircle size={26} />
            </div>
            <h3 className="font-black">No messages yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Start a private conversation with {friend.username}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.sender_id === userId;

              return (
                <div
                  key={message.id}
                  className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[82%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 border shadow-sm',
                      isMine
                        ? 'bg-primary text-primary-foreground border-primary rounded-br-md'
                        : 'bg-muted/60 text-foreground border-border/60 rounded-bl-md',
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                    <time
                      dateTime={message.created_at}
                      className={cn(
                        'block mt-1 text-[9px] font-mono text-right',
                        isMine
                          ? 'text-primary-foreground/65'
                          : 'text-muted-foreground',
                      )}
                    >
                      {formatMessageTimestamp(message.created_at)}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border/50 bg-background/70 p-4"
      >
        {!isFriend && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
            This connection is no longer active. Message history remains visible,
            but new messages are disabled.
          </div>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              maxLength={DIRECT_MESSAGE_MAX_LENGTH}
              rows={2}
              disabled={sending || !isFriend}
              placeholder={
                isFriend
                  ? `Message ${friend.username}...`
                  : 'Messaging unavailable'
              }
              className="w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <div className="mt-1 flex justify-between gap-3 px-1 text-[9px] text-muted-foreground">
              <span>Enter to send · Shift+Enter for a new line</span>
              <span className="font-mono">
                {draft.length}/{DIRECT_MESSAGE_MAX_LENGTH}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={!draft.trim() || sending || !isFriend}
            className="h-11 w-11 mb-4 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none"
            title="Send message"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
