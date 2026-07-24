import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { supabase } from '../../../lib/cloud/supabase';
import {
  createDirectMessage,
  fetchDirectMessages,
  isMessageInConversation,
} from '../services/directMessageService';
import type { DirectMessage } from '../types/chat';

interface UseDirectMessagesOptions {
  userId: string | null;
  friendId: string | null;
  isFriend: boolean;
}

interface UseDirectMessagesResult {
  messages: DirectMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }

  return 'The chat service is temporarily unavailable.';
}

function appendUniqueMessage(
  currentMessages: DirectMessage[],
  incomingMessage: DirectMessage,
): DirectMessage[] {
  if (currentMessages.some((message) => message.id === incomingMessage.id)) {
    return currentMessages;
  }

  return [...currentMessages, incomingMessage].sort((left, right) => {
    const timestampDifference =
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

    return timestampDifference || left.id.localeCompare(right.id);
  });
}

export function useDirectMessages({
  userId,
  friendId,
  isFriend,
}: UseDirectMessagesOptions): UseDirectMessagesResult {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const conversationGenerationRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!userId || !friendId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const history = await fetchDirectMessages(userId, friendId);
      if (requestId === requestIdRef.current) {
        setMessages(history);
      }
    } catch (fetchError) {
      if (requestId === requestIdRef.current) {
        setError(getErrorMessage(fetchError));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [friendId, userId]);

  useEffect(() => {
    conversationGenerationRef.current += 1;
    setMessages([]);
    setError(null);
    setSending(false);
    void refetch();

    if (!userId || !friendId) {
      return;
    }

    let active = true;
    const channel = supabase
      .channel(`direct-messages:${userId}:${friendId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload: RealtimePostgresInsertPayload<DirectMessage>) => {
          const incomingMessage = payload.new;
          if (
            active &&
            isMessageInConversation(incomingMessage, userId, friendId)
          ) {
            setMessages((currentMessages) =>
              appendUniqueMessage(currentMessages, incomingMessage),
            );
          }
        },
      )
      .subscribe((status) => {
        if (
          active &&
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        ) {
          setError('Live chat updates are unavailable. Retry the conversation.');
        }
      });

    return () => {
      active = false;
      requestIdRef.current += 1;
      conversationGenerationRef.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [friendId, refetch, userId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !friendId) {
        setError('Sign in and select a friend before sending a message.');
        return false;
      }

      if (!isFriend) {
        setError('This connection is no longer active. New messages are disabled.');
        return false;
      }

      setSending(true);
      setError(null);
      const conversationGeneration = conversationGenerationRef.current;

      try {
        const sentMessage = await createDirectMessage(userId, friendId, content);
        if (conversationGeneration !== conversationGenerationRef.current) {
          return false;
        }
        setMessages((currentMessages) =>
          appendUniqueMessage(currentMessages, sentMessage),
        );
        return true;
      } catch (sendError) {
        if (conversationGeneration === conversationGenerationRef.current) {
          setError(getErrorMessage(sendError));
        }
        return false;
      } finally {
        if (conversationGeneration === conversationGenerationRef.current) {
          setSending(false);
        }
      }
    },
    [friendId, isFriend, userId],
  );

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    refetch,
  };
}
