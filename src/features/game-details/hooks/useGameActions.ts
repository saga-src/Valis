
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';
import { useToast } from '../../../context/ToastContext';
import { useAutoSync } from '../../settings/hooks/useAutoSync';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';

export const useGameActions = (gameId: string) => {
  const { broadcastReview, broadcast } = useSocialBroadcast();
  const { toast } = useToast();
  const { performCloudUpload } = useAutoSync();
  const { user } = useAuth();

  const submitReview = async (game: any, rating: number, reviewText: string) => {
    try {
      // 1. Save Local
      await window.api.updateGame({
        ...game,
        id: game.id, // Ensure ID is passed explicitly
        user_rating: rating,
        review_text: reviewText
      });

      // 2. Broadcast Social
      broadcastReview(
        game.title || game.name,
        rating, // 1-5 stars
        reviewText,
        game.cover_url // Pass cover
      );

      // 3. Cloud Sync
      setTimeout(() => {
        performCloudUpload().catch(console.error);
      }, 5000);

      toast.success("Review published!");
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Failed to publish review");
      return false;
    }
  };

  const addToLibrary = async (gameData: any, options?: { silent?: boolean }) => {
    try {
      // 1. Add to local DB
      await window.api.addGame(gameData);
      
      // DEBUG LOG
      console.log("Adding game. Silent mode?", options?.silent);

      // 2. BROADCAST LOGIC (Conditional)
      if (!options?.silent) {
         console.log("Broadcasting 'Added to library' status...");
         await broadcast('status', {
           game: gameData.title || gameData.name,
           status: 'Backlog',
           detail: 'Added to library',
           cover_url: gameData.cover_url
         });
         toast.success("Game added to library");
      }

      // 3. Update Player Stats (Total Games Owned)
      if (user) {
        PlayerStatsService.incrementGamesOwned(user.id).catch(err => 
          console.error('[GameActions] Failed to increment stats:', err)
        );
      }

      // 4. Cloud Sync
      setTimeout(() => {
        performCloudUpload().catch(console.error);
      }, 5000);

    } catch (error) {
      console.error("Failed to add game:", error);
      toast.error("Failed to add game");
    }
  };

  const updateStatus = async (game: any, newStatus: string) => {
      const oldStatus = game.status;
      
      try {
          const updatedGame = { ...game, status: newStatus };
          
          // 1. Local Update
          await window.api.updateGame(updatedGame);
          
          // 2. Broadcast Status Change
          if (newStatus !== oldStatus) {
             await broadcast('status', {
                 game: game.title || game.name,
                 status: newStatus,
                 cover_url: game.cover_url
             });
          }

          // 3. Leaderboards & Stats (Completions)
          // Determine direction: 1 (Completed), -1 (Un-completed), or 0 (No relevant change)
          let increment = 0;
          let xpDelta = 0;

          if (newStatus === 'Completed' && oldStatus !== 'Completed') {
              increment = 1;
              xpDelta = 250; // Award XP
          } else if (oldStatus === 'Completed' && newStatus !== 'Completed') {
              increment = -1;
              xpDelta = -250; // Revoke XP
          }

          if (increment !== 0) {
              
              // ⚡ Local Fallback: Add/Remove XP locally (Guest/Offline support)
              if (window.api && window.api.addPlaytimeXP) {
                  window.api.addPlaytimeXP(xpDelta).catch(err => console.error("Local XP update failed:", err));
              }

              try {
                  // Call A: Global Beat Leaderboard
                  await supabase.rpc('update_leaderboard', {
                      p_category: 'beats',
                      p_sub_category: 'global',
                      p_increment: increment
                  });

                  // Call B: Genre Beats
                  let genres: any[] = [];
                  try {
                      genres = typeof game.genres === 'string' ? JSON.parse(game.genres) : game.genres;
                  } catch (e) { console.warn('[Leaderboard] Failed to parse genres'); }

                  if (Array.isArray(genres)) {
                      for (const g of genres) {
                          const genreName = typeof g === 'string' ? g : g.name;
                          if (genreName) {
                              await supabase.rpc('update_leaderboard', {
                                  p_category: 'beats',
                                  p_sub_category: genreName,
                                  p_increment: increment
                              });
                          }
                      }
                  }

                  // Call C: Update Player Stats & XP
                  console.log(`Broadcasting Game Status Change (Delta: ${increment})`, { games_beaten: increment, xp: xpDelta });
                  const { error: statsError } = await supabase.rpc('update_player_stats', {
                      games_beaten: increment,
                      xp: xpDelta
                  });

                  if (statsError) console.error('Stats update failed:', statsError);

              } catch (err) {
                  console.error('[Leaderboard] Completion Update Failed:', err);
              }
          }

          // 4. Update Beaten/Completed Lists in PlayerStats
          if (user && (newStatus === 'Beat' || newStatus === 'Completed')) {
             PlayerStatsService.syncBeatenGame(user.id, {
                id: game.id,
                title: game.title || game.name,
                cover: game.cover_url || '',
                score: game.final_score || 0
             });
          }
          
          if (user && newStatus === 'Completed') {
             PlayerStatsService.syncCompletedGame(user.id, {
                id: game.id,
                title: game.title || game.name,
                cover: game.cover_url || '',
                achievements: '100%'
             });
          }
          
          toast.success(`Status updated to ${newStatus}`);
          
          // 5. Cloud Sync
          setTimeout(() => {
            performCloudUpload().catch(console.error);
          }, 5000);

          return updatedGame;
      } catch (e: any) {
          console.error(e);
          toast.error("Failed to update status");
          return null;
      }
  };

  return { submitReview, addToLibrary, updateStatus };
};
