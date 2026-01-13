import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export const useFriendSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoadingRequests(true);
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender:profiles!sender_id (id, username, avatar_url),
        created_at
      `)
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
    
    if (error) console.error("Error fetching requests:", error);
    else setRequests(data || []);
    setLoadingRequests(false);
  }, [user]);

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('friendships')
      .select('friend:profiles!friend_id(id, username, avatar_url, playstyle)')
      .eq('user_id', user.id);
    
    if (error) console.error('Error fetching friends:', error);
    else setFriends(data?.map((f: any) => f.friend) || []);
  }, [user]);

  useEffect(() => {
    if (user) {
        fetchRequests();
        fetchFriends();
    }
  }, [user, fetchRequests, fetchFriends]);

  const sendRequest = useCallback(async (targetUsername: string) => {
    if (!user) return;

    try {
      // 1. Find the User ID from the Username
      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', targetUsername)
        .single(); 

      if (searchError || !profiles) throw new Error("User not found");
      if (profiles.id === user.id) throw new Error("You can't add yourself");

      // 2. Send the request
      const { error: reqError } = await supabase
        .from('friend_requests')
        .insert({ 
            sender_id: user.id, 
            receiver_id: profiles.id 
        });
      
      if (reqError) {
        if (reqError.code === '23505') throw new Error("Request already sent");
        throw reqError;
      }
      
      toast.success(`Request sent to ${targetUsername}!`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user, toast]);

  const acceptRequest = useCallback(async (requestId: string, friendId: string) => {
    if (!user) return;
    
    try {
      // A. Mark Request Accepted
      const { error: reqError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      if (reqError) throw reqError;

      // B. Double Write Friendship
      const { error: friendError } = await supabase
        .from('friendships')
        .insert([
          { user_id: user.id, friend_id: friendId },
          { user_id: friendId, friend_id: user.id }
        ]);
      if (friendError) throw friendError;

      toast.success("Friend added!");
      fetchRequests();
      fetchFriends();
    } catch (e: any) {
      toast.error("Error accepting friend: " + e.message);
    }
  }, [user, toast, fetchRequests, fetchFriends]);

  const rejectRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    if (error) toast.error(error.message);
    else {
      toast.success("Request ignored");
      fetchRequests(); 
    }
  }, [toast, fetchRequests]);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', friendId);
      
    if (error) toast.error(error.message);
    else {
      toast.success("Friend removed");
      fetchFriends(); 
    }
  }, [user, toast, fetchFriends]);

  const getFriendshipStatus = useCallback(async (targetUserId: string) => {
    if (!user || !targetUserId) return { isFriend: false, isPending: false, isIncoming: false };

    try {
        // 1. Check if already friends
        const { data: friend } = await supabase
          .from('friendships')
          .select('user_id') 
          .eq('user_id', user.id)
          .eq('friend_id', targetUserId)
          .maybeSingle();

        if (friend) return { isFriend: true, isPending: false, isIncoming: false };

        // 2. Check Outgoing Request
        const { data: outgoing } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', user.id)
          .eq('receiver_id', targetUserId)
          .eq('status', 'pending')
          .maybeSingle();

        if (outgoing) return { isFriend: false, isPending: true, isIncoming: false };

        // 3. Check Incoming Request
        const { data: incoming } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', targetUserId)
          .eq('receiver_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (incoming) return { isFriend: false, isPending: false, isIncoming: true };

        return { isFriend: false, isPending: false, isIncoming: false };
    } catch (error) {
        console.error("Status check failed:", error);
        return { isFriend: false, isPending: false, isIncoming: false };
    }
  }, [user]);

  return { sendRequest, acceptRequest, rejectRequest, fetchRequests, requests, loadingRequests, friends, fetchFriends, removeFriend, getFriendshipStatus };
};