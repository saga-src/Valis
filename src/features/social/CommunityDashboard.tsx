
import React, { useState, useEffect } from 'react';
import { SocialFeed } from './components/SocialFeed';
import { LeaderboardsTab } from './components/LeaderboardsTab';
import { useFriendSystem } from './hooks/useFriendSystem';
import { Users, UserPlus, Fingerprint, Globe, Check, X, UserMinus, Trophy, Share2, ClipboardCheck, Cloud, Loader2, LogIn, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils/cn';
import { useNavigate } from '../../app/index';
import { AuthWidget } from '../auth/components/AuthWidget';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommunityDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { 
    sendRequest, 
    requests, 
    friends, 
    acceptRequest, 
    rejectRequest, 
    removeFriend, 
    fetchRequests, 
    fetchFriends 
  } = useFriendSystem();
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const [targetUsername, setTargetUsername] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Tab State
  const [activeView, setActiveView] = useState<'feed' | 'leaderboard'>('leaderboard');
  // Auth Modal State for Guests
  const [isAuthOpen, setAuthOpen] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRequests();
      fetchFriends();
      setAuthOpen(false); // Close modal if user logs in
    }
  }, [user]);

  const copyMyInfo = () => {
    const info = profile?.username || user?.id;
    if (info) {
        navigator.clipboard.writeText(info);
        setCopied(true);
        toast.success("Identity copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    } else {
        toast.error("Not connected to cloud.");
    }
  };

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* 1. GUEST AUTH OVERLAY */}
      <AnimatePresence>
        {!user && isAuthOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md p-6 pointer-events-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md flex flex-col items-center gap-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto border border-primary/20 shadow-xl mb-4">
                  <Globe size={32} />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Community Hub</h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  Sign in to sync your saves, compete on leaderboards, and connect with other operatives.
                </p>
              </div>

              <AuthWidget variant="card" className="shadow-2xl ring-1 ring-border" />
              
              <button 
                onClick={() => setAuthOpen(false)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                Continue as Guest
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex flex-col lg:flex-row gap-6 p-6 overflow-hidden bg-background/50"
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden relative">
          
          {/* POLISHED HEADER */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-b border-border/50 bg-muted/20 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                      {activeView === 'feed' ? <Globe size={24} /> : <Trophy size={24} />}
                  </div>
                  <div>
                      <h2 className="text-xl font-black tracking-tight leading-none uppercase">
                          {activeView === 'feed' ? 'The Collective' : 'Elite Operatives'}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {activeView === 'feed' ? 'Real-time telemetry from the network' : 'Global performance rankings'}
                      </p>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                  {/* GUEST SIGN IN TRIGGER */}
                  {!user && !isAuthOpen && (
                    <button 
                      onClick={() => setAuthOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      <LogIn size={14} /> Sign In
                    </button>
                  )}

                  {/* IDENTIFY BUTTON (User Only) */}
                  {user && (
                    <button 
                        onClick={copyMyInfo}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95",
                            copied 
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                                : "bg-background hover:bg-muted border-border text-foreground/80"
                        )}
                    >
                        {copied ? <ClipboardCheck size={14} /> : <Fingerprint size={14} />}
                        {copied ? 'Copied' : 'Identify'}
                    </button>
                  )}

                  {/* SHARP VIEW TOGGLE */}
                  <div className="bg-background border border-border rounded-xl p-1 flex gap-1 shadow-inner">
                      <button 
                          onClick={() => setActiveView('feed')}
                          className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all",
                              activeView === 'feed' 
                                  ? "bg-primary text-primary-foreground shadow-md scale-105" 
                                  : "text-muted-foreground hover:text-foreground"
                          )}
                      >
                          Feed
                      </button>
                      <button 
                          onClick={() => setActiveView('leaderboard')}
                          className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all",
                              activeView === 'leaderboard' 
                                  ? "bg-primary text-primary-foreground shadow-md scale-105" 
                                  : "text-muted-foreground hover:text-foreground"
                          )}
                      >
                          Board
                      </button>
                  </div>
              </div>
          </div>

          {/* CONTENT RENDER */}
          <div className="flex-1 overflow-hidden">
              {activeView === 'feed' ? (
                  user ? (
                    <div className="h-full p-4 overflow-y-auto custom-scrollbar">
                        <SocialFeed />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground opacity-50">
                        <Lock size={32} />
                      </div>
                      <div className="max-w-xs space-y-2">
                        <h3 className="text-xl font-bold">Activity Feed Locked</h3>
                        <p className="text-sm text-muted-foreground">Sign in to see real-time telemetry and achievements from your friends and the collective.</p>
                      </div>
                      <AuthWidget variant="card" className="max-w-sm" />
                    </div>
                  )
              ) : (
                  <LeaderboardsTab />
              )}
          </div>
        </div>

        {/* Sidebar: Connections */}
        <div className="w-full lg:w-80 flex flex-col gap-6 h-full min-h-0">
          
          {/* 1. Pending Requests (User Only) */}
          {user && requests.length > 0 && (
            <div className="shrink-0 space-y-3 p-4 bg-primary/10 border border-primary/20 rounded-2xl animate-in slide-in-from-right-4 shadow-lg shadow-primary/5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Intercepted Links</h3>
                <span className="bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-full">
                  {requests.length}
                </span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {requests.map((req) => (
                  <div key={req.id} className="bg-background/80 backdrop-blur-sm p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3 group">
                    <div 
                      className="flex items-center gap-3 overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/profile/${req.sender.id}`)}
                    >
                      <img 
                        src={req.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.sender?.username}`}
                        className="w-8 h-8 rounded-full bg-muted object-cover border border-white/10" 
                        alt={req.sender?.username}
                      />
                      <span className="text-sm font-bold truncate hover:text-primary transition-colors underline-offset-4 decoration-2">
                        {req.sender?.username || 'Unknown'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => acceptRequest(req.id, req.sender.id)}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all"
                        title="Authorize"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => rejectRequest(req.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                        title="Decline"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Friends List (User Only) */}
          <div className="flex-1 min-h-0 flex flex-col gap-4 bg-card border border-border/50 rounded-2xl p-5 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                      <Users size={12} className="text-primary" /> Active Links
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{user ? friends.length : '0'} TOTAL</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {!user ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/50 opacity-60">
                    <Lock size={32} className="text-muted-foreground/40 mb-4" />
                    <p className="text-sm font-bold text-muted-foreground">Login Required</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">Establish encrypted links with other operatives by joining the Valis network.</p>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground/20">
                      <UserPlus size={32} />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">The link is severed.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">Transmit your unique identity code to establish a connection with other operatives.</p>
                  </div>
                ) : (
                  friends.map((friend: any) => (
                    <div 
                      key={friend.id} 
                      className="group flex items-center justify-between p-3 bg-muted/20 border border-transparent rounded-xl hover:border-primary/20 hover:bg-muted/40 transition-all cursor-pointer"
                      onClick={() => navigate(`/profile/${friend.id}`)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="relative shrink-0">
                          <img 
                            src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                            className="w-10 h-10 rounded-full bg-muted object-cover border border-white/5 shadow-md" 
                            alt={friend.username}
                          />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card shadow-sm" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors leading-none">{friend.username || 'Unknown'}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Level {friend.level || 1} • Online</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Sever link with ${friend.username}?`)) {
                                removeFriend(friend.id);
                            }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
          </div>

          {/* 3. Connection Widget (User Only) */}
          {user && (
            <div className="shrink-0 bg-card border border-border/50 rounded-2xl p-5 shadow-lg space-y-4">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                    <Share2 size={12} className="text-primary" /> Establish Link
                </h3>
                
                <div className="flex gap-2">
                    <input 
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        placeholder="ENTER ID..."
                        className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-xs font-mono focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/40"
                    />
                    <button 
                        onClick={() => { 
                            if(targetUsername) { sendRequest(targetUsername); setTargetUsername(''); } 
                        }}
                        disabled={!targetUsername}
                        className="bg-primary hover:brightness-110 text-primary-foreground p-2.5 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-primary/20 active:scale-90"
                        title="Transmit Request"
                    >
                        <UserPlus size={18} />
                    </button>
                </div>
            </div>
          )}

          {/* GUEST SIGN-IN CARD (Bottom Sidebar) */}
          {!user && (
            <div className="shrink-0 bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-lg space-y-3">
               <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                    <Cloud size={12} /> Cloud Features
                </h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Sign in to create a persistent operative identity, unlock global rank tracking, and enable automatic cloud telemetry backups.
                </p>
                <button 
                  onClick={() => setAuthOpen(true)}
                  className="w-full py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95"
                >
                  Join the Network
                </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
