import React, { useState, useEffect } from 'react';
import { useParams } from '../../app/index';
import { useAuth } from '../../context/AuthContext';
import { useProfileData } from '../social/hooks/useProfileData';
import { useUserProfile } from './hooks/useUserProfile';
import { Loader2, CloudOff, UserPlus, MessageSquare, Check, Clock } from 'lucide-react';
import { PROGRESSION_TREE } from '../gamification/logic/milestones';
import { useFriendSystem } from '../social/hooks/useFriendSystem';

// Components
import { ProfileHero } from './components/ProfileHero';
import { StatsStrip } from './components/StatsStrip';
import { TrophyShowcase } from './components/TrophyShowcase';
import { BeatenGamesShelf } from './components/BeatenGamesShelf';
import { MilestoneWallet } from './components/MilestoneWallet';
import { ProtocolArtifactsWallet } from './components/ProtocolArtifactsWallet';
import { CurrentObsessionCard } from './components/CurrentObsessionCard';

// Modals
import EditProfileModal from './EditProfileModal';
import ProfileShareModal from './ProfileShareModal';

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const { sendRequest, getFriendshipStatus } = useFriendSystem();
  
  // Determine context
  const isSelf = !userId || (user && user.id === userId);
  const isGuest = !user && !userId;

  // 1. Fetch Cloud Data (if applicable)
  const { data: cloudProfile, isLoading: cloudLoading, refetch: refreshCloud } = useProfileData(userId);

  // 2. Fetch Local Data (Fallback for Guest)
  const { profile: localProfile, loading: localLoading, refresh: refreshLocal } = useUserProfile();

  // 3. Determine Active Profile Data
  const loading = isGuest ? localLoading : cloudLoading;
  
  // Construct View Model
  let displayProfile: any = null;
  
  if (isGuest) {
     displayProfile = {
         identity: localProfile.identity,
         leveling: localProfile.leveling,
         stats: localProfile.stats,
         // Local profile fallback mappings
         beaten: [], 
         perfect_games: localProfile.showcase,
         milestones: {}, // Local stats not currently mapped to milestone objects
         artifacts: [],   // Local artifacts not implemented yet
         current_obsession: null,
         preferences: localProfile.preferences
     };
  } else if (cloudProfile) {
     const cloudPerfectGames = (cloudProfile.perfect_games || []).map((game: any, idx: number) => ({
        id: game.id || `show_${idx}`,
        title: game.title,
        cover_url: game.cover,
        rating: undefined
     }));

     const localPerfectGames = isSelf
        ? (localProfile.showcase || []).map(game => ({
            id: game.id,
            title: game.title,
            cover_url: game.cover_url,
            rating: game.rating
        }))
        : [];

     const perfectGameMap = new Map<string, any>();
     [...cloudPerfectGames, ...localPerfectGames].forEach((game) => {
        const key = String(game.id || game.title);
        perfectGameMap.set(key, game);
     });

     // Map Cloud Data to UI Model
     displayProfile = {
        identity: {
            id: cloudProfile.id,
            username: cloudProfile.username,
            display_name: cloudProfile.display_name,
            avatar_url: cloudProfile.avatar_url || '',
            title: cloudProfile.playstyle || 'Gamer',
            bio: cloudProfile.bio || ''
        },
        leveling: {
            level: cloudProfile.level,
            current_xp: cloudProfile.current_xp,
            next_level_xp: cloudProfile.next_level_xp,
            xp_progress_percent: 0 
        },
        stats: {
            total_playtime: Math.max(cloudProfile.total_playtime || 0, isSelf ? localProfile.stats.total_playtime : 0),
            games_owned: Math.max(cloudProfile.games_owned || 0, isSelf ? localProfile.stats.games_owned : 0),
            games_beaten: Math.max(cloudProfile.games_beaten || 0, isSelf ? localProfile.stats.games_beaten : 0),
            total_platinum: Math.max(cloudProfile.total_platinum || 0, isSelf ? localProfile.stats.total_platinum : 0)
        },
        // Map Artifacts (Strings)
        artifacts: cloudProfile.artifacts || [],
        
        // Map Milestones (JSON Object)
        milestones: cloudProfile.milestones || {},

        // Map Completed Games to Showcase format
        perfect_games: Array.from(perfectGameMap.values()),
        
        // Map Beaten Games
        beaten: cloudProfile.beaten_games_list || [],
        
        // Current Obsession
        current_obsession: cloudProfile.current_obsession,

        // Preferences
        preferences: {
            pinned_badges: cloudProfile.preferences?.pinned_badges || [],
            pinned_artifacts: cloudProfile.preferences?.pinned_artifacts || []
        }
     };
  }

  const [isEditing, setIsEditing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'friend' | 'pending' | 'incoming'>('none');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const targetId = displayProfile?.identity?.id;

    if (!isSelf && user && targetId) {
        getFriendshipStatus(targetId).then(status => {
            if (status.isFriend) setFriendStatus('friend');
            else if (status.isPending) setFriendStatus('pending');
            else if (status.isIncoming) setFriendStatus('incoming');
            else setFriendStatus('none');
        });
    }
  }, [isSelf, user, displayProfile?.identity?.id, getFriendshipStatus]);

  const handleAddFriend = async () => {
    if (!displayProfile?.identity.username) return;

    setActionLoading(true);
    await sendRequest(displayProfile.identity.username);
    setFriendStatus('pending');
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm font-medium animate-pulse">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!displayProfile) {
      return <div className="p-10 text-center text-muted-foreground">Profile not found.</div>;
  }

  // Convert seconds to hours for display
  const playtimeHours = displayProfile.stats.total_playtime / 3600;

  // Transform DB JSON to Badge Array for MilestoneWallet using PROGRESSION_TREE metadata
  const milestoneBadges = displayProfile ? Object.entries(displayProfile.milestones || {})
    .filter(([_, val]) => typeof val === 'object' && val !== null && (val as any).rank)
    .map(([key, val]: [string, any]) => {
        // Find Metadata in Tree
        // Key is discipline ID (e.g. 'collector')
        let metaDiscipline = null;
        let metaArchetype = null;

        for (const arch of PROGRESSION_TREE) {
            const found = arch.disciplines.find(d => d.id === key);
            if (found) {
                metaDiscipline = found;
                metaArchetype = arch;
                break;
            }
        }

        return {
            id: key,
            title: metaDiscipline ? metaDiscipline.name : val.label,
            label: metaDiscipline ? metaDiscipline.name : val.label, // Alias for EditProfileModal
            rank: val.rank,
            maxRanks: metaDiscipline ? metaDiscipline.tiers.length : 5, // Important for visuals
            icon: metaDiscipline ? metaDiscipline.icon : 'Trophy',
            iconName: metaDiscipline ? metaDiscipline.icon : 'Trophy', // For BadgeCard
            collection: metaArchetype ? metaArchetype.name : val.archetype,
            archetype: metaArchetype ? metaArchetype.name : (val.archetype || 'Milestone'), // For BadgeCard
            description: metaDiscipline ? metaDiscipline.description : '',
            unlockedAt: val.updated_at || null,
            color: metaArchetype ? metaArchetype.color : '#ffffff',
            unlocked: true // It's in the list, so it's unlocked
        };
    }) : [];

  return (
    <div className="h-full overflow-y-auto bg-background pb-20 custom-scrollbar">
      
      {/* Guest Banner */}
      {isGuest && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wide">
          <CloudOff size={14} />
          <span>Viewing Local Profile. Sign in to sync your stats to the cloud.</span>
        </div>
      )}

      {/* 1. Hero Section */}
      <ProfileHero 
        username={displayProfile.identity.display_name || displayProfile.identity.username}
        title={displayProfile.identity.title}
        avatarUrl={displayProfile.identity.avatar_url}
        level={displayProfile.leveling.level}
        currentXP={displayProfile.leveling.current_xp}
        nextLevelXP={displayProfile.leveling.next_level_xp}
        onEdit={isSelf ? () => setIsEditing(true) : undefined}
        onShare={() => setIsSharing(true)}
      />

      {/* Social Actions (if not self) */}
      {!isSelf && (
          <div className="max-w-[1600px] mx-auto px-6 lg:px-8 mt-6 flex justify-end gap-3">
              {friendStatus === 'friend' ? (
                  <div className="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 font-bold rounded-xl flex items-center gap-2 text-sm cursor-default">
                      <Check size={16} /> Friends
                  </div>
              ) : friendStatus === 'incoming' ? (
                  <div className="px-4 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold rounded-xl flex items-center gap-2 text-sm cursor-default">
                      <UserPlus size={16} /> Request Received
                  </div>
              ) : (
                  <button 
                    onClick={handleAddFriend}
                    disabled={friendStatus === 'pending' || actionLoading}
                    className={`px-4 py-2 font-bold rounded-xl flex items-center gap-2 text-sm shadow-sm transition-all ${
                        friendStatus === 'pending' 
                            ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
                    }`}
                  >
                      {actionLoading ? <Loader2 size={16} className="animate-spin"/> : 
                       friendStatus === 'pending' ? <Clock size={16} /> : <UserPlus size={16} />}
                      {friendStatus === 'pending' ? 'Request Sent' : 'Add Friend'}
                  </button>
              )}
              <button className="px-4 py-2 border border-border bg-card hover:bg-muted font-bold rounded-xl flex items-center gap-2 text-sm transition-all">
                  <MessageSquare size={16} /> Message
              </button>
          </div>
      )}

      {/* 2. Stats Strip */}
      <StatsStrip 
        playtimeHours={playtimeHours}
        gamesOwned={displayProfile.stats.games_owned}
        gamesBeaten={displayProfile.stats.games_beaten}
        platinums={displayProfile.stats.total_platinum}
        className={!isSelf ? "mt-6" : ""}
      />

      {/* 3. Main Content (Forced Vertical Layout) */}
      <div className="max-w-[1200px] mx-auto p-6 lg:p-8 space-y-8">
        
        <div className="flex flex-col gap-8 w-full min-w-0">
           {/* 1. Current Obsession */}
           <CurrentObsessionCard data={displayProfile.current_obsession} />
           
           {/* 2. Milestones */}
           <MilestoneWallet 
              badges={
                  (displayProfile as any).preferences?.pinned_badges?.length > 0 
                  ? milestoneBadges.filter(b => (displayProfile as any).preferences.pinned_badges.includes(b.id))
                  : milestoneBadges
              } 
              title="Career Milestones" 
              layout="row" 
           />

           {/* 3. Journal Entries */}
           <BeatenGamesShelf games={displayProfile.beaten} title="Journal Entries" />
           
           {/* 4. Trophy Case */}
           <TrophyShowcase games={displayProfile.perfect_games} title="Trophy Case" />

           {/* 5. Artifacts */}
           <ProtocolArtifactsWallet 
              artifactIds={
                  (displayProfile as any).preferences?.pinned_artifacts?.length > 0
                  ? displayProfile.artifacts.filter((id: string) => (displayProfile as any).preferences.pinned_artifacts.includes(id))
                  : displayProfile.artifacts
              }
              fullWidth={true}
           />
        </div>

      </div>

      {/* Edit Modal (Only for Self) */}
      {isSelf && isEditing && (
        <EditProfileModal 
          isOpen={isEditing} 
          onClose={() => setIsEditing(false)} 
          currentSettings={{
            username: displayProfile.identity.username,
            displayName: displayProfile.identity.display_name || displayProfile.identity.username,
            bio: displayProfile.identity.bio || '',
            title: displayProfile.identity.title,
            avatarUrl: displayProfile.identity.avatar_url,
            highlightBadgeId: null, 
            favorites: [],
            obsessions: [],
            pinned_badges: (displayProfile as any).preferences?.pinned_badges || [],
            pinned_artifacts: (displayProfile as any).preferences?.pinned_artifacts || []
          }}
          unlockedBadges={milestoneBadges as any[]} 
          unlockedArtifacts={displayProfile.artifacts}
          onSave={async (newSettings) => {
              setIsEditing(false);
              if (isGuest) refreshLocal();
              else await refreshCloud();
          }}
        />
      )}

      {/* Share Modal */}
      {isSharing && (
        <ProfileShareModal 
          isOpen={isSharing}
          onClose={() => setIsSharing(false)}
          settings={{
            username: displayProfile.identity.username,
            displayName: displayProfile.identity.display_name || displayProfile.identity.username,
            bio: displayProfile.identity.bio || '',
            title: displayProfile.identity.title,
            avatarUrl: displayProfile.identity.avatar_url,
            highlightBadgeId: null,
            favorites: [],
            obsessions: [],
            pinned_badges: (displayProfile as any).preferences?.pinned_badges || [],
            pinned_artifacts: (displayProfile as any).preferences?.pinned_artifacts || []
          }}
          profile={{
              level: displayProfile.leveling.level,
              currentXp: displayProfile.leveling.current_xp,
              nextLevelXp: displayProfile.leveling.next_level_xp,
              badges: [],
              activity: { isPlaying: false },
              stats: {
                  totalGames: displayProfile.stats.games_owned,
                  totalHours: playtimeHours,
                  gamesBeaten: displayProfile.stats.games_beaten,
                  mostPlayedGenre: 'N/A'
              }
          }}
        />
      )}

    </div>
  );
};
