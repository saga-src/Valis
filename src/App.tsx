import React, { useEffect, Suspense, lazy, useRef } from 'react';
// Fix: Import Routes and Route from local shim index file to avoid casing conflict with App.tsx
import { Routes, Route, useLocation } from './app/index';
import { AppProviders } from './app/AppProviders';
import { Sidebar } from './components/ui/Sidebar';
import { DebugErrorBoundary } from './components/ui/DebugErrorBoundary';
import { Loader2 } from 'lucide-react';
import { SyncProgressToast } from './features/library/components/SyncProgressToast';
import { UpdateToast } from './components/ui/UpdateToast';
import { useMarkObserver } from './features/gamification/hooks/useMarkObserver';
import { useAuth } from './context/AuthContext';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import { TourManager } from './features/onboarding/TourManager';
import { UpdateNotesModal } from './features/update/UpdateNotesModal';

// Import assets for bundling
import achievementSound from '../public/sounds/achievements.mp3';

// Lazy Pages
const GameLibrary = lazy(() => import('./features/library/GameLibrary').then(module => ({ default: module.GameLibrary })));
const SearchGame = lazy(() => import('./features/library/components/SearchGame').then(module => ({ default: module.SearchGame })));
const GameDetails = lazy(() => import('./features/game-details/GameDetails').then(module => ({ default: module.GameDetails })));
const AnalyticsDashboard = lazy(() => import('./features/analytics/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(module => ({ default: module.ProfilePage })));
const QuickPlayPage = lazy(() => import('./features/quick-play/QuickPlayPage').then(module => ({ default: module.QuickPlayPage })));
const JournalPage = lazy(() => import('./features/journal/JournalPage').then(module => ({ default: module.JournalPage })));
const MilestonesPage = lazy(() => import('./features/gamification/MilestonesPage').then(module => ({ default: module.MilestonesPage })));
// Simplified lazy load for default export
const CommunityDashboard = lazy(() => import('./features/social/CommunityDashboard'));

const LoadingFallback = () => (
  <div className="flex h-full items-center justify-center text-muted-foreground gap-3">
    <Loader2 className="animate-spin text-primary" size={32} />
    <span className="font-medium animate-pulse tracking-wide">Loading module...</span>
  </div>
);

const AppLayout: React.FC = () => {
  const { reportSignal } = useMarkObserver();
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  
  // Auth Check for Onboarding
  const { user, profile, refreshProfile } = useAuth();

  // 1. Track App Init
  useEffect(() => {
    reportSignal('APP_INIT');
  }, []);

  // 2. Track Page Visits
  useEffect(() => {
    reportSignal('PAGE_VISIT', location.pathname);
  }, [location.pathname]);

  // 3. Track Scroll (The Abyss)
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const position = (scrollTop + clientHeight) / scrollHeight;
    
    // Only report if we are deep down
    if (position > 0.9) {
       // We pass position and can pass library count if available in context, 
       // but here we just signal the scroll event. 
       // The Rule check needs totalGames from state, which useMarkObserver handles via useGamification metrics.
       reportSignal('LIBRARY_SCROLL', { position });
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased relative">
      
      {/* Update Notes Overlay */}
      <UpdateNotesModal />

      {/* Onboarding Overlay */}
      {user && profile && !profile.onboarding_complete && (
        <OnboardingWizard onComplete={refreshProfile} />
      )}

      {/* Main Tour Manager (Local First Onboarding) */}
      <TourManager />

      <SyncProgressToast />
      <UpdateToast />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background/50">
        <main 
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<GameLibrary />} />
              <Route path="/add" element={<SearchGame />} />
              <Route 
                path="/play" 
                element={
                  <DebugErrorBoundary componentName="Play Page">
                    <QuickPlayPage />
                  </DebugErrorBoundary>
                } 
              />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/game/:id" element={<GameDetails />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/milestones" element={<MilestonesPage />} />
              <Route path="/community" element={<CommunityDashboard />} />
              <Route 
                path="/analytics" 
                element={
                  <DebugErrorBoundary componentName="Analytics Page">
                    <AnalyticsDashboard />
                  </DebugErrorBoundary>
                } 
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/:tab" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Check if API exists to prevent crashes
    if (window.api && window.api.onPlaySound) {
        const removeListener = window.api.onPlaySound((type: string) => {
          if (type === 'achievement') {
            console.log('🔊 Playing achievement sound');
            const audio = new Audio(achievementSound); 
            audio.volume = 0.5;
            audio.onerror = (e) => console.error('❌ Achievement audio file failed:', e);
            audio.play().catch(e => console.error("Audio playback failed:", e));
          }
        });
        return () => removeListener();
    }
  }, []);

  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
};

export default App;