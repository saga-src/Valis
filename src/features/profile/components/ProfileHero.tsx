import React from 'react';
import { Share2, Edit2, Shield, User, PenLine } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface ProfileHeroProps {
  username: string;
  title: string;
  level: number;
  currentXP: number;
  nextLevelXP: number;
  avatarUrl: string;
  bannerUrl?: string;
  rank?: number;
  onEdit?: () => void;
  onShare?: () => void;
}

export const ProfileHero: React.FC<ProfileHeroProps> = ({
  username,
  title,
  level,
  currentXP,
  nextLevelXP,
  avatarUrl,
  bannerUrl,
  rank,
  onEdit,
  onShare
}) => {
  const progress = Math.min(100, Math.max(0, (currentXP / nextLevelXP) * 100));
  const isEditable = !!onEdit;

  return (
    <div className="relative w-full h-[340px] bg-zinc-900 overflow-hidden group rounded-b-3xl shadow-2xl border-b border-white/5">
      {/* Background Layer */}
      <div className="absolute inset-0">
        {bannerUrl ? (
          <img 
            src={bannerUrl} 
            alt="Banner" 
            className="w-full h-full object-cover opacity-60 blur-sm scale-105 group-hover:scale-100 transition-transform duration-700" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="absolute inset-0 flex flex-col justify-end px-8 pb-8 z-10">
        <div className="flex flex-col md:flex-row items-end gap-6">
          
          {/* Avatar Cluster */}
          <div className="relative shrink-0">
            <div className="w-32 h-32 rounded-full bg-card border-4 border-background shadow-xl overflow-hidden flex items-center justify-center relative group z-10">
              {avatarUrl ? (
                  <img 
                      src={avatarUrl} 
                      alt={username} 
                      className="w-full h-full object-cover"
                  />
              ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                      <User size={40} className="text-muted-foreground/50" />
                  </div>
              )}
              
              {/* Edit Overlay (Only if editable) */}
              {isEditable && (
                  <button 
                      onClick={onEdit}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  >
                      <PenLine size={20} />
                  </button>
              )}
            </div>
            {/* Level Badge */}
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground font-black text-lg w-10 h-10 flex items-center justify-center rounded-full border-4 border-background z-20 shadow-lg">
              {level}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 mb-2">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                {username}
              </h1>
              {rank && (
                <div className="px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md">
                  <Shield size={10} />
                  Global Rank #{rank}
                </div>
              )}
            </div>
            
            <p className="text-lg font-medium text-yellow-500/90 font-display tracking-wide mb-4">
              {title}
            </p>

            {/* XP Bar */}
            <div className="w-full max-w-md">
              <div className="flex justify-between text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                <span>Progress</span>
                <span className="font-mono text-zinc-300">{Math.floor(currentXP)} / {nextLevelXP} XP</span>
              </div>
              <div className="h-2 w-full bg-black/50 backdrop-blur-sm rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-2">
             {onShare && (
               <button 
                 onClick={onShare}
                 className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white backdrop-blur-md transition-colors"
                 title="Share Profile"
               >
                 <Share2 size={20} />
               </button>
             )}
             {onEdit && (
               <button 
                 onClick={onEdit}
                 className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white backdrop-blur-md transition-colors"
                 title="Edit Profile"
               >
                 <Edit2 size={20} />
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};