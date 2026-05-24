
import React, { useEffect } from 'react';
import { HashRouter } from './index';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { PresenceProvider, usePresence } from '../context/PresenceContext';
import { getSavedTheme, applyTheme } from '../lib/theme';
import { useHealthMonitor } from '../features/health/useHealthMonitor';
import { useSessionSync } from '../features/session-tracker/useSessionSync';
import { AchievementNotifier } from '../features/gamification/components/AchievementNotifier';
import { GamificationWatcher } from '../features/gamification/hooks/useGamification';
import { useSyncStore } from '../store/syncStore';
import { useAutoSync } from '../features/settings/hooks/useAutoSync';
import { useAchievements } from '../features/achievements/hooks/useAchievements';
import { useMilestones } from '../features/gamification/hooks/useMilestones';
import { useSessionStore } from '../features/session-tracker/store';
import { useSocialBroadcast } from '../features/social/hooks/useSocialBroadcast';
import { PlayerStatsService } from '../features/social/services/PlayerStatsService';
import { handleDataChangeInvalidation } from '../lib/cache/invalidation';
import { useCloudBackupQueue } from '../lib/cloud/useCloudBackupQueue';

const PresenceSyncService: React.FC = () => {
  const { updateActivity } = usePresence();
  const activeSession = useSessionStore(state => state.activeSession);

  useEffect(() => {
    if (activeSession) {
      updateActivity('playing', activeSession.gameTitle);
    } else {
      updateActivity('online');
    }
  }, [activeSession, updateActivity]);

  return null;
};

const AppBackgroundServices: React.FC = () => {
  useHealthMonitor();
  useSessionSync();
  useAchievements();
  useMilestones();

  const { user } = useAuth();
  const { checkSyncOnLoad, performCloudUpload } = useAutoSync();
  const { broadcastSync } = useSocialBroadcast();
  useCloudBackupQueue({ performCloudUpload });

  useEffect(() => {
    if (user) {
      checkSyncOnLoad();
    }
  }, [user]);

  const { updateProgress, setSyncing } = useSyncStore();
  
  useEffect(() => {
    if (window.api && window.api.onSteamSyncProgress) {
        const removeListener = window.api.onSteamSyncProgress((data: any) => {
            setSyncing(true);
            updateProgress(data.message, data.current || 0, data.total || 0);
        });
        return () => removeListener();
    }
  }, []);

  // ⚡ SOCIAL SYNC LISTENER
  useEffect(() => {
    if (window.api?.onSocialBroadcastSync) {
        const remove = window.api.onSocialBroadcastSync((data: any) => {
            if (user) {
                broadcastSync(data.platform, data.added, data.achievements);
            }
        });
        return remove;
    }
  }, [user, broadcastSync]);

  useEffect(() => {
    if (window.api?.onDataChanged) {
      const remove = window.api.onDataChanged(handleDataChangeInvalidation);
      return remove;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const syncCompletedProfileGame = async (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.type !== 'game' || detail?.source !== 'achievement-completion' || !detail.gameId) return;
      if (!window.api?.getGameById) return;

      try {
        const game = await window.api.getGameById(detail.gameId);
        if (!game || game.status !== 'Completed') return;

        const achievements = window.api.getGameAchievements
          ? await window.api.getGameAchievements(detail.gameId)
          : [];
        const totalAchievements = achievements.length;
        const unlockedAchievements = achievements.filter((achievement: any) => achievement.unlockedAt || achievement.defaultUnlocked).length;
        const achievementLabel = totalAchievements > 0
          ? `${unlockedAchievements}/${totalAchievements}`
          : '100%';

        await Promise.all([
          PlayerStatsService.syncBeatenGame(user.id, {
            id: game.id,
            title: game.title || game.name,
            cover: game.cover_url || '',
            score: game.final_score || 0
          }),
          PlayerStatsService.syncCompletedGame(user.id, {
            id: game.id,
            title: game.title || game.name,
            cover: game.cover_url || '',
            achievements: achievementLabel
          })
        ]);

        window.dispatchEvent(new CustomEvent('valis-profile-data-refresh', { detail }));
      } catch (error) {
        console.error('[ProfileSync] Failed to sync completed achievement game:', error);
      }
    };

    window.addEventListener('valis-data-update', syncCompletedProfileGame);
    return () => window.removeEventListener('valis-data-update', syncCompletedProfileGame);
  }, [user]);

  useEffect(() => {
    if (window.api?.onAppClosing) {
      const remove = window.api.onAppClosing(async () => {
        if (user) {
          try {
            await performCloudUpload({ reason: 'safe-exit', markDirty: true, force: true });
          } catch (e) {
            console.error('[SafeExit] Final cloud upload failed:', e);
          }
        }
        window.api.sendReadyToQuit();
      });
      return remove;
    }
  }, [user, performCloudUpload]);

  return (
    <>
      <GamificationWatcher />
      <PresenceSyncService />
    </>
  );
};

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <PresenceProvider>
          <OnboardingProvider>
            <HashRouter>
              <AppBackgroundServices />
              <AchievementNotifier />
              {children}
            </HashRouter>
          </OnboardingProvider>
        </PresenceProvider>
      </AuthProvider>
    </ToastProvider>
  );
};
