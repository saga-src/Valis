import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/cloud/supabase';

export type PresenceState = {
  user_id: string;
  status: 'online' | 'playing' | 'idle';
  game_title?: string;
  started_at?: string; // ISO string
  last_seen: string;
};

interface PresenceContextType {
  onlineUsers: Record<string, PresenceState>;
  updateActivity: (status: 'online' | 'playing' | 'idle', gameTitle?: string) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({});
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setOnlineUsers({});
      return;
    }

    const room = supabase.channel('global_presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        const users: Record<string, PresenceState> = {};

        // Flatten Supabase presence structure (array of objects) to single latest state per user
        Object.keys(newState).forEach(key => {
          if (newState[key] && newState[key].length > 0) {
            users[key] = newState[key][0] as PresenceState;
          }
        });

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            user_id: user.id,
            status: 'online',
            last_seen: new Date().toISOString(),
          });
        }
      });

    setChannel(room);

    return () => {
      supabase.removeChannel(room);
    };
  }, [user]);

  const updateActivity = useCallback(async (status: 'online' | 'playing' | 'idle', gameTitle?: string) => {
    if (!channel || !user) return;

    await channel.track({
      user_id: user.id,
      status,
      game_title: gameTitle,
      started_at: status === 'playing' ? new Date().toISOString() : undefined,
      last_seen: new Date().toISOString(),
    });
  }, [channel, user]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, updateActivity }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};
