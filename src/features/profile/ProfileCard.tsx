import React, { useState } from 'react';
import { GamerProfile, UserLevel } from '../gamification/logic/types';
import { useProfileSettings } from './useProfileSettings';
import EditProfileModal from './EditProfileModal';
import ProfileShareModal from './ProfileShareModal';
import { Trophy, Clock, Gamepad2, Edit2, Share2, Star } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface ProfileCardProps {
  profile: GamerProfile;
  levelInfo: UserLevel;
}

export default function ProfileCard({ profile, levelInfo }: ProfileCardProps) {
  const { settings, updateProfile } = useProfileSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const progressPercent = Math.min(100, (profile.currentXp / profile.nextLevelXp) * 100);
  
  // Logic: Find the badge object that matches the saved ID
  const highlightBadge = settings.highlightBadgeId 
    ? profile.badges.find(b => b.id === settings.highlightBadgeId)
    : null;

  const unlockedBadges = profile.badges.filter(b => b.unlocked);

  return (
    <>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden shadow-2xl relative group mx-auto">
        {/* Header BG */}
        <div className="h-32 bg-gradient-to-r from-primary/80 to-purple-600/80 relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay" />
           
           {/* Actions (Visible on Hover) */}
           <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
               <button 
                 onClick={() => setIsSharing(true)}
                 className="p-2 bg-background/30 hover:bg-background/50 rounded-full text-foreground/90 hover:text-foreground backdrop-blur-sm border border-border/10"
                 title="Share Profile"
               >
                 <Share2 size={16} />
               </button>
               <button 
                 onClick={() => setIsEditing(true)}
                 className="p-2 bg-background/30 hover:bg-background/50 rounded-full text-foreground/90 hover:text-foreground backdrop-blur-sm border border-border/10"
                 title="Edit Profile"
               >
                 <Edit2 size={16} />
               </button>
           </div>
        </div>

        <div className="px-6 pb-6 relative">
           {/* Avatar */}
           <div className="w-24 h-24 rounded-full bg-card border-4 border-card absolute -top-12 left-6 flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-background/50">
               <img src={settings.avatarUrl} alt="avatar" className="w-full h-full object-cover bg-muted" />
           </div>

           {/* Name & Title */}
           <div className="pl-28 pt-3 mb-6">
              <h2 className="text-2xl font-black tracking-tight text-card-foreground leading-tight truncate">
                {settings.username}
              </h2>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-1 truncate">
                {settings.title}
              </div>

              {highlightBadge && (
                <div className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border mt-2", highlightBadge.color)}>
                   <span>{highlightBadge.icon}</span> {highlightBadge.label}
                </div>
              )}
           </div>

           {/* Stats Row */}
           <div className="flex gap-4 mb-6 mt-4">
              <div className="flex-1 bg-muted/50 rounded-lg p-2 border border-border flex flex-col gap-1">
                 <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> Most Played
                 </div>
                 <div className="font-bold text-sm text-foreground truncate" title={profile.activity.mostPlayedGame?.title}>
                    {profile.activity.mostPlayedGame?.title || "-"}
                 </div>
              </div>
              <div className="flex-1 bg-muted/50 rounded-lg p-2 border border-border flex flex-col gap-1">
                 <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Star size={10} /> Top Rated
                 </div>
                 <div className="font-bold text-sm text-foreground truncate" title={profile.activity.highestRatedGame?.title}>
                    {profile.activity.highestRatedGame?.title || "-"}
                 </div>
              </div>
           </div>

           {/* Level Stats */}
           <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Current Rank</div>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl">{levelInfo.icon}</span>
                        <div>
                            <div className="text-xl font-black text-card-foreground leading-none">{levelInfo.title}</div>
                            <div className="text-xs text-primary font-bold">Level {profile.level}</div>
                        </div>
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="text-xs text-muted-foreground font-mono font-medium">{Math.floor(profile.currentXp)} / {profile.nextLevelXp} XP</div>
                    <div className="text-[10px] text-muted-foreground">to next level</div>
                 </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                 <div 
                   className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000 ease-out relative"
                   style={{ width: `${progressPercent}%` }}
                 >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                 </div>
              </div>
           </div>

           {/* Status Footer */}
           <div className="border-t border-border pt-4">
               {profile.activity.isPlaying ? (
                 <div className="flex items-center gap-3 text-green-500 animate-pulse">
                    <Gamepad2 size={20} />
                    <div>
                       <div className="text-xs font-bold uppercase tracking-wider">Now Playing</div>
                       <div className="font-bold text-foreground truncate max-w-[200px]">
                          {profile.activity.lastPlayedGame?.title || "Unknown Game"}
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock size={20} />
                    <div>
                       <div className="text-xs font-bold uppercase tracking-wider">Last Played</div>
                       <div className="font-medium text-foreground truncate max-w-[200px]">
                          {profile.activity.lastPlayedGame?.title || "Nothing yet"}
                       </div>
                       {profile.activity.lastPlayedDate && (
                         <div className="text-xs">
                            {profile.activity.lastPlayedDate.toLocaleDateString()}
                         </div>
                       )}
                    </div>
                 </div>
               )}
           </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditProfileModal 
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        currentSettings={settings}
        unlockedBadges={unlockedBadges}
        onSave={updateProfile}
      />

      {/* Share Modal */}
      <ProfileShareModal 
        isOpen={isSharing}
        onClose={() => setIsSharing(false)}
        profile={profile}
        settings={settings}
      />
    </>
  );
}