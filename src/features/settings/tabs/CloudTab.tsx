import React, { useState } from 'react';
import { Cloud, LogOut, Loader2, User, RefreshCw, Database } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useAutoSync } from '../hooks/useAutoSync';
import { LogoutModal } from '../../../components/ui/LogoutModal';
import { AuthWidget } from '../../auth/components/AuthWidget';

export const CloudTab = () => {
  const { user, profile, signOut, loading } = useAuth();
  const { toast } = useToast();
  const { performCloudUpload } = useAutoSync();
  
  // New state for modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogoutFlow = async () => {
    setIsSyncing(true);
    try {
      // 1. FORCE CLOUD SYNC
      await performCloudUpload();
      
      // 2. WIPE LOCAL DATA
      if (window.api) {
        await window.api.wipeUserData();
      }

      // 3. SIGN OUT
      await signOut();
      
      toast.success('Sync complete. Logged out successfully.');
      setShowLogoutModal(false);
      
      // 4. Force Reload to clear in-memory state
      window.location.reload();

    } catch (err: any) {
      console.error(err);
      setIsSyncing(false);
      // Optional: Ask user if they want to force logout anyway?
      const force = window.confirm("Cloud sync failed. Force logout anyway? (Unsaved progress may be lost)");
      if (force) {
         if (window.api) await window.api.wipeUserData();
         await signOut();
         window.location.reload();
      }
    }
  };

  const handleProfileSync = async () => {
    try {
      setIsSyncing(true);
      if (window.api?.getSyncStats) {
        const stats = await window.api.getSyncStats();
        if (stats && user) {
          // In a full implementation, we'd upload these stats to Supabase here
          toast.success("Profile stats calculated and ready for sync.");
        } else {
          toast.error("Failed to calculate stats or no user session.");
        }
      }
      setIsSyncing(false);
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
      toast.error("Failed to sync profile stats.");
    }
  };

  const handleDatabaseSync = async () => {
    try {
      setIsSyncing(true);
      await performCloudUpload();
      toast.success("Database backup synchronized to cloud.");
      setIsSyncing(false);
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
      toast.error("Database backup failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-bold">Cloud & Sync</h2>
        <p className="text-muted-foreground">Sign in to sync your profile and access social features.</p>
      </div>

      {user ? (
        <div className="space-y-6">
          <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-4xl overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    <span>{profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{profile?.username || 'Valis User'}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-md border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </div>
                </div>

                <button 
                  onClick={() => setShowLogoutModal(true)}
                  className="px-4 py-2 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                >
                  <LogOut size={16} /> Disconnect
                </button>
            </div>
          </div>

          {/* Manual Sync Controls */}
          <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest mb-4">Manual Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={handleProfileSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-3 p-4 bg-muted/30 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/50 transition-all font-bold text-sm group"
              >
                {isSyncing ? <Loader2 size={18} className="animate-spin text-primary" /> : <RefreshCw size={18} className="text-primary group-hover:rotate-180 transition-transform duration-500" />}
                Sync Profile Stats
              </button>
              
              <button 
                onClick={handleDatabaseSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-3 p-4 bg-muted/30 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/50 transition-all font-bold text-sm group"
              >
                {isSyncing ? <Loader2 size={18} className="animate-spin text-primary" /> : <Database size={18} className="text-primary" />}
                Backup Database
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 italic">
              Note: Auto-sync triggers every 5 minutes and after major library updates.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Login Form (Extracted to AuthWidget) */}
           <AuthWidget variant="card" />

           {/* Info / Promo */}
           <div className="flex flex-col justify-center space-y-6 text-muted-foreground p-4">
              <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-primary">
                    <Cloud size={20} />
                 </div>
                 <div>
                    <h4 className="font-bold text-foreground">Cross-Device Sync</h4>
                    <p className="text-sm mt-1">Keep your library, playtime, and journals synchronized across all your devices.</p>
                 </div>
              </div>
              
              <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-purple-500">
                    <User size={20} />
                 </div>
                 <div>
                    <h4 className="font-bold text-foreground">Social Profile</h4>
                    <p className="text-sm mt-1">Create a public profile to share your collection, reviews, and completion stats.</p>
                 </div>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-600 dark:text-yellow-400">
                 <strong>Note:</strong> We prioritize local-first data. Cloud features are opt-in and serve as a backup/sharing layer. Your local vault remains fully functional offline.
              </div>
           </div>
        </div>
      )}

      {/* Logout Modal */}
      <LogoutModal 
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutFlow}
        isSyncing={isSyncing}
      />
    </div>
  );
};