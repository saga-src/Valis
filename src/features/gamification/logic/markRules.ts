import { GeneralMark } from './generalMarks';

// --- Types ---
export type MarkSignal = 
  | 'APP_INIT'              // Daily Check
  | 'THEME_CHANGE'          // Switching Light/Dark/Stealth
  | 'LOGO_CLICK'            // Clicking the header logo
  | 'VERSION_CLICK'         // Clicking version number
  | 'GAME_LAUNCH'           // Watcher detected .exe start
  | 'GAME_CLOSE'            // Watcher detected .exe close
  | 'PLAYTIME_TICK'         // Stopwatch/Timer update
  | 'LIBRARY_SCROLL'        // Scrolling the grid
  | 'SEARCH_QUERY'          // Searching (Strictly IGDB/Add Game)
  | 'PAGE_VISIT'            // Navigation
  | 'TOUCH_GRASS_ALERT'     // The health alert popping up
  | 'VIEW_MODE_UPDATE'      // Changing views (Grid, List, Museum, Data)
  | 'FILTER_CHANGE'         // Applying filters
  | 'SESSION_SAVED'         // User finished and saved a session
  | 'SAVE_JOURNAL'          // Writing a specific Journal Entry
  | 'IMPORT_LIBRARY'        // Steam/Epic import
  | 'SOURCE_UPDATE'         // Connection status change
  | 'RANDOM_GAME_PICK'      // Using the randomizer
  | 'GAME_CARD_CLICK'       // Clicking a specific game card
  | 'LOG_MOOD'              // Logging a mood
  | 'ACHIEVEMENT_UNLOCK';   // Unlocking an achievement

interface MarkRule {
  markId: string;
  signal: MarkSignal;
  check: (payload?: any, state?: any) => boolean; 
}

// --- Internal Session State (Reset on App Restart) ---
const sessionState = {
  logoClicks: 0,
  logoClickTimer: null as any,
  versionClicks: 0,
  cardClicks: { id: '', count: 0 },
  visitedPages: new Set<string>(),
  touchGrassTriggered: false,
  touchGrassTime: 0,
};

// --- THE RULES ---
export const MARK_RULES: MarkRule[] = [
  // 1. CLICK INTERACTIONS
  {
    markId: 'ghost_in_the_machine',
    signal: 'LOGO_CLICK',
    check: () => {
      sessionState.logoClicks++;
      clearTimeout(sessionState.logoClickTimer);
      sessionState.logoClickTimer = setTimeout(() => sessionState.logoClicks = 0, 1000); 
      return sessionState.logoClicks >= 10;
    }
  },
  {
    markId: 'architects_signature',
    signal: 'VERSION_CLICK',
    check: () => {
      sessionState.versionClicks++;
      return sessionState.versionClicks >= 5;
    }
  },
  {
    markId: 'the_loop',
    signal: 'GAME_CARD_CLICK',
    check: (gameId: string) => {
      if (gameId === sessionState.cardClicks.id) {
        sessionState.cardClicks.count++;
      } else {
        sessionState.cardClicks = { id: gameId, count: 1 };
      }
      return sessionState.cardClicks.count >= 5;
    }
  },

  // 2. NAVIGATION & UI
  {
    markId: 'the_cartographer',
    signal: 'PAGE_VISIT',
    check: (path: string) => {
      const required = [
        '/analytics', '/milestones', '/profile', '/add-game', 
        '/journal', '/quick-play', '/settings', '/library'
      ];
      sessionState.visitedPages.add(path);
      return required.every(p => sessionState.visitedPages.has(p));
    }
  },
  {
    markId: 'the_mirror',
    signal: 'PAGE_VISIT',
    check: (path, state) => path === '/profile' && (state?.stats?.profileVisits || 0) >= 50
  },
  {
    markId: 'the_filter',
    signal: 'FILTER_CHANGE',
    check: (activeFilters: any[]) => activeFilters.length >= 3
  },
  {
    markId: 'the_echo',
    signal: 'SEARCH_QUERY', 
    check: ({ results, context }) => results === 0 && context === 'ADD_GAME'
  },
  {
    markId: 'the_abyss',
    signal: 'LIBRARY_SCROLL',
    check: ({ position, totalGames }) => position >= 0.99 && totalGames > 500
  },

  // 3. THEME & TIME
  {
    markId: 'the_ghost',
    signal: 'PLAYTIME_TICK',
    check: (_, state) => state?.theme === 'stealth' && (state?.stats?.totalStealthRuntime || 0) >= 50 * 3600
  },
  {
    markId: 'the_daywalker',
    signal: 'THEME_CHANGE',
    check: (newTheme, state) => newTheme === 'light' && (state?.session?.lastStealthDuration || 0) >= 4 * 3600
  },
  {
    markId: 'the_night_owl',
    signal: 'APP_INIT',
    check: () => {
      const h = new Date().getHours();
      return h >= 1 && h < 5;
    }
  },
  {
    markId: 'the_constant',
    signal: 'APP_INIT',
    check: (_, state) => (state?.stats?.consecutiveDaysOpen || 0) >= 7
  },

  // 4. DATA & CONTENT
  {
    markId: 'the_scribe',
    signal: 'SAVE_JOURNAL',
    check: (content: string) => content.length > 500
  },
  {
    markId: 'the_labeler',
    signal: 'SESSION_SAVED',
    check: (_, state) => (state?.stats?.uniqueTaggedSessions || 0) >= 50
  },
  {
    markId: 'the_emotionalist',
    signal: 'LOG_MOOD',
    check: (_, state) => (state?.stats?.consecutiveMoodLogStreak || 0) >= 10
  },
  {
    markId: 'the_oracle',
    signal: 'RANDOM_GAME_PICK',
    check: (_, state) => (state?.stats?.randomPickCount || 0) >= 10
  },
  {
    markId: 'the_1337',
    signal: 'APP_INIT',
    check: (_, state) => (state?.library?.totalGames || 0) === 1337
  },
  {
    markId: 'the_identity',
    signal: 'APP_INIT',
    check: (_, state) => (state?.stats?.archetypeStreak || 0) >= 30
  },

  // 5. CONNECTIONS & HARDWARE
  {
    markId: 'the_neural_handshake',
    signal: 'IMPORT_LIBRARY',
    check: (_, state) => (state?.stats?.hasImportedExternal || false)
  },
  {
    markId: 'the_trinity',
    signal: 'SOURCE_UPDATE',
    check: (activeSources: string[]) => activeSources.length >= 3
  },
  {
    markId: 'the_overclocker',
    signal: 'GAME_LAUNCH',
    check: (_, state) => state?.settings?.isHardwareMonitorPinned === true
  },
  {
    markId: 'the_bottleneck',
    signal: 'GAME_LAUNCH',
    check: (_, state) => (state?.hardware?.ramUsage || 0) > 90
  },
  {
    markId: 'the_archaeologist',
    signal: 'ACHIEVEMENT_UNLOCK',
    check: ({ source }) => source === 'LOCAL_WATCHER'
  },

  // 6. MODES
  {
    markId: 'the_gallerist',
    signal: 'VIEW_MODE_UPDATE',
    check: (_, state) => (state?.stats?.totalMuseumTime || 0) >= 3600
  },
  {
    markId: 'the_accountant',
    signal: 'PLAYTIME_TICK', 
    check: (_, state) => state?.session?.currentDataViewDuration >= 30 * 60
  },

  // 7. WELLNESS
  {
    markId: 'touch_grass',
    signal: 'GAME_CLOSE',
    check: () => {
      if (!sessionState.touchGrassTriggered) return false;
      const timeSinceAlert = Date.now() - sessionState.touchGrassTime;
      return timeSinceAlert < 5 * 60 * 1000; // 5 min tolerance
    }
  },
  {
    markId: 'the_marathon',
    signal: 'PLAYTIME_TICK',
    check: () => {
      if (!sessionState.touchGrassTriggered) return false;
      const timeSinceAlert = Date.now() - sessionState.touchGrassTime;
      return timeSinceAlert >= 60 * 60 * 1000; // Played 1h after alert
    }
  }
];

export const updateMarkSessionState = (key: keyof typeof sessionState, value: any) => {
    // @ts-ignore
    sessionState[key] = value;
};
