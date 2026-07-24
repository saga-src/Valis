import { supabase } from '../../../lib/cloud/supabase';
import type {
  DirectMessage,
  ReceivedDirectMessageHeader,
} from '../types/chat';

export const DIRECT_MESSAGE_MAX_LENGTH = 2000;
export const DIRECT_MESSAGE_INITIAL_LIMIT = 50;
const RECEIVED_MESSAGE_PAGE_SIZE = 1000;

export function normalizeDirectMessageContent(content: string): string {
  const normalized = content.trim();

  if (!normalized) {
    throw new Error('Message cannot be empty.');
  }

  if (normalized.length > DIRECT_MESSAGE_MAX_LENGTH) {
    throw new Error(`Messages are limited to ${DIRECT_MESSAGE_MAX_LENGTH} characters.`);
  }

  return normalized;
}

function sortMessagesChronologically(messages: DirectMessage[]): DirectMessage[] {
  return [...messages].sort((left, right) => {
    const timestampDifference =
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

    return timestampDifference || left.id.localeCompare(right.id);
  });
}

export async function fetchDirectMessages(
  userId: string,
  friendId: string,
  limit = DIRECT_MESSAGE_INITIAL_LIMIT,
): Promise<DirectMessage[]> {
  if (!userId || !friendId || userId === friendId) {
    return [];
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, receiver_id, content, created_at')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return sortMessagesChronologically((data || []) as DirectMessage[]);
}

export async function createDirectMessage(
  senderId: string,
  receiverId: string,
  content: string,
): Promise<DirectMessage> {
  if (!senderId || !receiverId) {
    throw new Error('Sign in and select a friend before sending a message.');
  }

  if (senderId === receiverId) {
    throw new Error('You cannot send a message to yourself.');
  }

  const normalizedContent = normalizeDirectMessageContent(content);
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content: normalizedContent,
    })
    .select('id, sender_id, receiver_id, content, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data as DirectMessage;
}

export async function fetchReceivedDirectMessageHeaders(
  userId: string,
): Promise<ReceivedDirectMessageHeader[]> {
  if (!userId) return [];

  const receivedMessages: ReceivedDirectMessageHeader[] = [];
  let pageStart = 0;

  while (true) {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, created_at')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pageStart, pageStart + RECEIVED_MESSAGE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as ReceivedDirectMessageHeader[];
    receivedMessages.push(...page);

    if (page.length < RECEIVED_MESSAGE_PAGE_SIZE) {
      break;
    }

    pageStart += RECEIVED_MESSAGE_PAGE_SIZE;
  }

  return receivedMessages;
}

export function isMessageInConversation(
  message: DirectMessage,
  userId: string,
  friendId: string,
): boolean {
  return (
    (message.sender_id === userId && message.receiver_id === friendId) ||
    (message.sender_id === friendId && message.receiver_id === userId)
  );
}
