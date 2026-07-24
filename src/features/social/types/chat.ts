export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export interface DirectMessageCursor {
  id: string;
  created_at: string;
}

export interface ReceivedDirectMessageHeader extends DirectMessageCursor {
  sender_id: string;
}

export interface ChatFriend {
  id: string;
  username: string;
  avatar_url?: string | null;
  playstyle?: string | null;
}
