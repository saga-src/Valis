import React, { useEffect } from 'react';
import { HashRouter } from './index';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { getSavedTheme, applyTheme } from '../lib/theme';
import { useHealthMonitor } from '../features/health/useHealthMonitor';
import { useSessionSync } from '../features/session-tracker/useSessionSync';
import { AchievementNotifier } from '../features/gamification/components/AchievementNotifier';
import { GamificationWatcher } from '../features/gamification/hooks/useGamification';
import { useSyncStore } from '../store/syncStore';
import { useAutoSync } from '../features/settings/hooks/useAutoSync';
import { useAchievements } from '../features/achievements/hooks/useAchievements';
import { useMilestones } from '../features/gamification/hooks/useMilestones';

/**
 * A helper component to run hooks that rely on Router Context
 * or generic background tasks.
 */
const AppBackgroundServices: React.FC = () => {
  // Initialize Background Health Monitor
  useHealthMonitor();
  
  // Initialize Watcher Synchronization
  useSessionSync();
  
  // Initialize Social Broadcasting for Achievements & Milestones
  useAchievements();
  useMilestones();

  // Cloud Sync Automation
  const { user } = useAuth();
  const { checkSyncOnLoad } = useAutoSync();

  useEffect(() => {
    if (user) {
      checkSyncOnLoad();
    }
  }, [user]);

  // Global Sync Progress Listener
  const { updateProgress, setSyncing } = useSyncStore();
  
  useEffect(() => {
    if (window.api && window.api.onSteamSyncProgress) {
        const removeListener = window.api.onSteamSyncProgress((data: any) => {
            // Ensure UI is showing if an event comes in (failsafe)
            setSyncing(true);
            updateProgress(data.message, data.current || 0, data.total || 0);
        });
        return () => removeListener();
    }
  }, []);

  return (
    <>
      <GamificationWatcher />
    </>
  );
};

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  // Apply saved theme on mount
  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <OnboardingProvider>
          <HashRouter>
            <AppBackgroundServices />
            <AchievementNotifier />
            {children}
          </HashRouter>
        </OnboardingProvider>
      </AuthProvider>
    </ToastProvider>
  );
};