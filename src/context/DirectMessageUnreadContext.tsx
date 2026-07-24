import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/cloud/supabase';
import { fetchReceivedDirectMessageHeaders } from '../features/social/services/directMessageService';
import type {
  DirectMessage,
  DirectMessageCursor,
  ReceivedDirectMessageHeader,
} from '../features/social/types/chat';

interface DirectMessageUnreadContextValue {
  unreadBySender: Record<string, number>;
  totalUnread: number;
  markConversationRead: (
    friendId: string,
    through?: DirectMessageCursor,
  ) => void;
  setActiveConversation: (friendId: string | null) => void;
}

type ReadCursorMap = Record<string, DirectMessageCursor>;
type UnreadIdMap = Record<string, Set<string>>;

const DirectMessageUnreadContext =
  createContext<DirectMessageUnreadContextValue | undefined>(undefined);

const storageKeyForUser = (userId: string) =>
  `valis:direct-message-read-cursors:${userId}`;

function compareCursors(
  left: DirectMessageCursor,
  right: DirectMessageCursor,
): number {
  const createdAtComparison = left.created_at.localeCompare(right.created_at);
  return createdAtComparison || left.id.localeCompare(right.id);
}

function isAfterCursor(
  message: DirectMessageCursor,
  cursor?: DirectMessageCursor,
): boolean {
  return !cursor || compareCursors(message, cursor) > 0;
}

function laterCursor(
  left?: DirectMessageCursor,
  right?: DirectMessageCursor,
): DirectMessageCursor | undefined {
  if (!left) return right;
  if (!right) return left;
  return compareCursors(left, right) >= 0 ? left : right;
}

function loadReadCursors(userId: string): ReadCursorMap {
  try {
    const stored = localStorage.getItem(storageKeyForUser(userId));
    if (!stored) return {};

    const parsed = JSON.parse(stored) as ReadCursorMap;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, cursor]) =>
          cursor &&
          typeof cursor.id === 'string' &&
          typeof cursor.created_at === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function saveReadCursors(userId: string, cursors: ReadCursorMap) {
  try {
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(cursors));
  } catch {
    // Unread state remains available for the current app session.
  }
}

export const DirectMessageUnreadProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuth();
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>(
    {},
  );
  const readCursorsRef = useRef<ReadCursorMap>({});
  const unreadIdsRef = useRef<UnreadIdMap>({});
  const latestIncomingRef = useRef<
    Record<string, ReceivedDirectMessageHeader>
  >({});
  const activeConversationRef = useRef<string | null>(null);

  const publishUnreadCounts = useCallback(() => {
    setUnreadBySender(
      Object.fromEntries(
        Object.entries(unreadIdsRef.current)
          .map(([senderId, ids]) => [senderId, ids.size])
          .filter(([, count]) => count > 0),
      ),
    );
  }, []);

  const advanceReadCursor = useCallback(
    (friendId: string, through?: DirectMessageCursor) => {
      if (!user || !through) return;

      const current = readCursorsRef.current[friendId];
      if (!isAfterCursor(through, current)) return;

      readCursorsRef.current = {
        ...readCursorsRef.current,
        [friendId]: through,
      };
      saveReadCursors(user.id, readCursorsRef.current);
    },
    [user],
  );

  const markConversationRead = useCallback(
    (friendId: string, through?: DirectMessageCursor) => {
      if (!friendId) return;

      const latestKnown = latestIncomingRef.current[friendId];
      const cursor = laterCursor(through, latestKnown);
      advanceReadCursor(friendId, cursor);

      if (unreadIdsRef.current[friendId]?.size) {
        unreadIdsRef.current[friendId] = new Set();
        publishUnreadCounts();
      }
    },
    [advanceReadCursor, publishUnreadCounts],
  );

  const setActiveConversation = useCallback(
    (friendId: string | null) => {
      activeConversationRef.current = friendId;
      if (friendId) {
        markConversationRead(friendId);
      }
    },
    [markConversationRead],
  );

  useEffect(() => {
    activeConversationRef.current = null;
    unreadIdsRef.current = {};
    latestIncomingRef.current = {};
    readCursorsRef.current = user ? loadReadCursors(user.id) : {};
    publishUnreadCounts();

    if (!user) return;

    let active = true;

    const processIncoming = (message: ReceivedDirectMessageHeader) => {
      if (!active || !message.sender_id) return;

      const latestIncoming = latestIncomingRef.current[message.sender_id];
      if (!latestIncoming || compareCursors(message, latestIncoming) > 0) {
        latestIncomingRef.current[message.sender_id] = message;
      }

      if (activeConversationRef.current === message.sender_id) {
        advanceReadCursor(message.sender_id, message);
        unreadIdsRef.current[message.sender_id] = new Set();
      } else if (
        isAfterCursor(message, readCursorsRef.current[message.sender_id])
      ) {
        const senderUnread =
          unreadIdsRef.current[message.sender_id] || new Set<string>();
        senderUnread.add(message.id);
        unreadIdsRef.current[message.sender_id] = senderUnread;
      }
    };

    const loadUnreadMessages = async () => {
      try {
        const receivedMessages = await fetchReceivedDirectMessageHeaders(user.id);
        if (!active) return;

        receivedMessages.forEach(processIncoming);

        const activeFriendId = activeConversationRef.current;
        if (activeFriendId) {
          markConversationRead(activeFriendId);
        }
        publishUnreadCounts();
      } catch {
        // The regular chat remains usable if unread metadata cannot be loaded.
      }
    };

    const channel = supabase
      .channel(`direct-message-unread:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload: RealtimePostgresInsertPayload<DirectMessage>) => {
          const message = payload.new;
          if (!active || message.receiver_id !== user.id) return;

          processIncoming({
            id: message.id,
            sender_id: message.sender_id,
            created_at: message.created_at,
          });
          publishUnreadCounts();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void loadUnreadMessages();
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [
    advanceReadCursor,
    markConversationRead,
    publishUnreadCounts,
    user,
  ]);

  const totalUnread = useMemo(
    () => Object.values(unreadBySender).reduce((total, count) => total + count, 0),
    [unreadBySender],
  );

  const value = useMemo(
    () => ({
      unreadBySender,
      totalUnread,
      markConversationRead,
      setActiveConversation,
    }),
    [
      markConversationRead,
      setActiveConversation,
      totalUnread,
      unreadBySender,
    ],
  );

  return (
    <DirectMessageUnreadContext.Provider value={value}>
      {children}
    </DirectMessageUnreadContext.Provider>
  );
};

export function useDirectMessageUnread() {
  const context = useContext(DirectMessageUnreadContext);
  if (!context) {
    throw new Error(
      'useDirectMessageUnread must be used within DirectMessageUnreadProvider',
    );
  }
  return context;
}
