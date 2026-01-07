import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export const useFriendSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = async () => {
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
  };

  const fetchFriends = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('friendships')
      .select('friend:profiles!friend_id(id, username, avatar_url, subscription_tier)')
      .eq('user_id', user.id);
    
    if (error) console.error('Error fetching friends:', error);
    else setFriends(data?.map((f: any) => f.friend) || []);
  };

  useEffect(() => {
    if (user) {
        fetchRequests();
        fetchFriends();
    }
  }, [user]);

  const sendRequest = async (targetUsername: string) => {
    if (!user) return;

    try {
      // 1. Find the User ID from the Username
      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', targetUsername)
        .single(); // Expecting exactly one result

      if (searchError || !profiles) throw new Error("User not found");
      if (profiles.id === user.id) throw new Error("You can't add yourself");

      // 2. Send the request using the found ID
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
  };

  const acceptRequest = async (requestId: string, friendId: string) => {
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
  };

  const rejectRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    if (error) toast.error(error.message);
    else {
      toast.success("Request ignored");
      fetchRequests(); // Refresh list
    }
  };

  const removeFriend = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', friendId);
      
    if (error) toast.error(error.message);
    else {
      toast.success("Friend removed");
      fetchFriends(); // Refresh list
    }
  };

  return { sendRequest, acceptRequest, rejectRequest, fetchRequests, requests, loadingRequests, friends, fetchFriends, removeFriend };
};