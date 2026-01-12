import { ReactNode } from 'react';

export type TourStep = {
  id: string;
  title: string;
  body: string;
  target?: string; // CSS selector for spotlight
  padding?: number; // Visual padding for the spotlight hole
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'bottom-right' | 'bottom-center';
  actionLabel?: string;
  showSkip?: boolean;
  component?: ReactNode; // For custom interactive elements
  route?: string; // Route to navigate to when this step starts
  waitForRoute?: string; // Auto-advance when this route is reached
  isInteractive?: boolean; // If true, allows interaction with the background page
  trigger?: 'next' | 'click'; // 'next': button on card, 'click': target element click
  disableOverlayInteraction?: boolean; // If true, blocks interaction even in the spotlight hole
};

export const SETUP_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Valis',
    body: 'Your unified command center for game tracking. Let’s initialize your database.',
    actionLabel: "Let's Go",
    position: 'center',
    trigger: 'next'
  },
  {
    id: 'nav-settings',
    title: 'Access Calibration',
    body: 'Click the Settings gear in the sidebar.',
    target: '#nav-settings',
    position: 'right',
    waitForRoute: '/settings',
    showSkip: false,
    trigger: 'click'
  },
  {
    id: 'tab-integrations',
    title: 'Select Integrations',
    body: 'Switch to the Integrations tab.',
    target: '#settings-tab-integrations',
    padding: 4,
    position: 'bottom',
    route: '/settings',
    waitForRoute: '/settings/integrations',
    trigger: 'click'
  },
  {
    id: 'link-accounts',
    title: 'Connect Your World',
    body: 'Select a platform below to configure your connection. If you aren\'t ready to link yet, click "Link Later" to explore manual setup options.',
    target: '#integrations-content',
    position: 'left',
    route: '/settings/integrations',
    trigger: 'next' 
  },
  {
    id: 'steam-api-manual',
    title: 'Steam Achievements',
    body: 'To track Steam achievements, you need a Web API Key. This is optional, but required if you want to have achievements listed (except for PSN/Xbox exclusives).',
    target: '#steam-api-key-section',
    padding: 10,
    position: 'top',
    route: '/settings/integrations',
    trigger: 'next'
  },
  {
    id: 'trigger-sync',
    title: 'Global Sync',
    body: 'Telemetry is ready. Click the Sync button on your connected accounts to fetch your library, playtime, and artifacts.',
    target: 'DYNAMIC', // Resolved in TourOverlay.tsx
    route: '/settings/integrations',
    trigger: 'click',
    position: 'left'
  },
  {
    id: 'watcher',
    title: 'Automated Tracking',
    body: 'Valis monitors background processes. Remember to link .exe files in the "Edit Game" window for accurate tracking.',
    actionLabel: 'Got it',
    position: 'center',
    trigger: 'next'
  },
  {
    id: 'nav-milestones',
    title: 'View Your Identity',
    body: 'Click the Milestones icon in the sidebar to view your Gamer Profile and progression.',
    target: '#nav-milestones',
    trigger: 'click',
    waitForRoute: '/milestones',
    position: 'right'
  },
  {
    id: 'archetypes-highlight',
    title: 'Your Archetype',
    body: 'This is your Gamer DNA. It evolves based on how you play—completing games, writing reviews, or logging hours.',
    target: '#archetypes-container',
    route: '/milestones',
    trigger: 'next',
    position: 'top'
  },
  {
    id: 'artifacts-highlight',
    title: 'Protocol Artifacts',
    body: 'These are secret achievements awarded for unique behaviors and playstyles. Discover them all to complete your collection.',
    target: '#artifacts-container',
    route: '/milestones',
    trigger: 'next',
    position: 'top',
    actionLabel: 'Finish Setup'
  }
];

export const WALKTHROUGH_TOUR: TourStep[] = [
  {
    id: 'filters',
    title: 'Control Your View',
    body: 'Use these filters to slice your library by Platform, Genre, or "Time to Beat".',
    target: '#library-filter-bar',
    position: 'bottom',
    route: '/',
    actionLabel: 'Next',
    trigger: 'next'
  },
  {
    id: 'game-card',
    title: 'The Game Matrix',
    body: 'Click a game card to explore details.',
    target: '.game-card:first-child',
    position: 'right',
    trigger: 'click'
  },
  {
    id: 'game-tabs',
    title: 'Game Sections',
    body: 'Explore your hub. Use **Sessions** to view history or manually log missed gameplay. Write **Casual** or **Critical** reviews in **Reviews**, and track **Achievements**.',
    target: '#game-details-tabs',
    trigger: 'next',
    position: 'bottom'
  },
  {
    id: 'quick-play',
    title: 'Manual Session',
    body: 'Start a timer manually here. Perfect for tracking console gameplay, or if you prefer not to use the automatic activity watcher for PC games.',
    target: '#btn-quick-play',
    trigger: 'next',
    position: 'bottom',
    disableOverlayInteraction: true
  },
  {
    id: 'edit-game',
    title: 'Edit Details',
    body: 'Click here to open the game editor and manage your library data.',
    target: '#btn-edit-game',
    trigger: 'click',
    position: 'bottom'
  },
  {
    id: 'edit-status',
    title: 'Game Status',
    body: 'Track your progress. Mark games as "Backlog", "Playing", "Beat", "Completed", "Dropped", "Shelved" or "Endless" to organize your library.',
    target: '#edit-status-select',
    trigger: 'next',
    position: 'bottom'
  },
  {
    id: 'edit-link',
    title: 'Link Executable',
    body: 'Connect your local game file (.exe) here. This allows Valis to launch the game and automatically track your playtime.',
    target: '#edit-link-section',
    trigger: 'next',
    position: 'top'
  },
  {
    id: 'edit-platforms',
    title: 'Manage Platforms',
    body: 'Select which platforms you own the game on, the acquisition date, and the price. You can only add platforms where the game is officially available.',
    target: '#edit-platforms-section',
    trigger: 'next',
    position: 'top'
  },
  {
    id: 'edit-legacy',
    title: 'Legacy Playtime',
    body: 'Import your history before Valis. Manually add time to keep lifetime stats accurate. (Note: Sync automatically imports this for most platforms, except Xbox).',
    target: '#edit-legacy-input',
    trigger: 'next',
    position: 'top'
  },
  {
    id: 'edit-save',
    title: 'Save Changes',
    body: 'Click "Save Changes" to update your library and close the editor.',
    target: '#edit-modal-save',
    trigger: 'click',
    position: 'left'
  },
  {
    id: 'sidebar-quick-play',
    title: 'Quick Access',
    body: 'You can also start a manual session directly from the sidebar, accessible from anywhere in the app.',
    target: '#sidebar-quick-play',
    trigger: 'next',
    position: 'right'
  },
  {
    id: 'journal',
    title: 'Your Timeline',
    body: 'A chronological feed of every trophy unlocked, game added, and session played.',
    target: '#nav-journal',
    position: 'right',
    actionLabel: 'Next',
    trigger: 'next'
  },
  {
    id: 'community',
    title: 'Go Online',
    body: 'Create a Valis account to sync your profile and backup your progression.',
    target: '#nav-community',
    position: 'right',
    route: '/community',
    actionLabel: 'Finish Tour',
    trigger: 'next'
  }
];