
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
    // @ts-ignore
    if (window.api && window.api.on) {
        // @ts-ignore
        const remove = window.api.on('SOCIAL_BROADCAST_SYNC', (data: any) => {
            if (user) {
                broadcastSync(data.platform, data.added, data.achievements);
            }
        });
        return remove;
    }
  }, [user, broadcastSync]);

  useEffect(() => {
    if (window.api?.onAppClosing) {
      const remove = window.api.onAppClosing(async () => {
        if (user) {
          try {
            await performCloudUpload();
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
