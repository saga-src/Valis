
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';
import { useToast } from '../../../context/ToastContext';
import { useAutoSync } from '../../settings/hooks/useAutoSync';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';

export const useGameActions = (gameId: string) => {
  const { broadcastReview, broadcastStatusChange, broadcastGameAdded } = useSocialBroadcast();
  const { toast } = useToast();
  const { performCloudUpload } = useAutoSync();
  const { user } = useAuth();

  const submitReview = async (game: any, rating: number, reviewText: string) => {
    try {
      await window.api.updateGame({
        ...game,
        id: game.id,
        user_rating: rating,
        review_text: reviewText
      });

      broadcastReview(
        game.title || game.name,
        rating,
        reviewText,
        game.cover_url
      );

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
      await window.api.addGame(gameData);
      
      if (!options?.silent) {
         broadcastGameAdded(
           gameData.title || gameData.name, 
           gameData.platform || 'Unknown', 
           gameData.price || 0,
           gameData.cover_url
         );
         toast.success("Game added to library");
      }

      if (user) {
        PlayerStatsService.incrementGamesOwned(user.id).catch(err => 
          console.error('[GameActions] Failed to increment stats:', err)
        );
      }

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
          await window.api.updateGame(updatedGame);
          
          if (newStatus !== oldStatus) {
             broadcastStatusChange(game.title || game.name, oldStatus, newStatus, game.cover_url);
          }

          let increment = 0;
          let xpDelta = 0;

          if (newStatus === 'Completed' && oldStatus !== 'Completed') {
              increment = 1;
              xpDelta = 250;
          } else if (oldStatus === 'Completed' && newStatus !== 'Completed') {
              increment = -1;
              xpDelta = -250;
          }

          if (increment !== 0) {
              if (window.api && window.api.addPlaytimeXP) {
                  window.api.addPlaytimeXP(xpDelta).catch(err => console.error("Local XP update failed:", err));
              }

              try {
                  await supabase.rpc('update_leaderboard', {
                      p_category: 'beats',
                      p_sub_category: 'global',
                      p_increment: increment
                  });

                  let genres: any[] = [];
                  try {
                      genres = typeof game.genres === 'string' ? JSON.parse(game.genres) : game.genres;
                  } catch (e) {}

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

                  await supabase.rpc('update_player_stats', {
                      games_beaten: increment,
                      xp: xpDelta
                  });

              } catch (err) {
                  console.error('[Leaderboard] Completion Update Failed:', err);
              }
          }

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
