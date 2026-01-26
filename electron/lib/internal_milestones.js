export const PROGRESSION_TREE = [
  {
    id: 'archivist',
    name: 'The Archivist',
    icon: 'Library',
    description: 'Focus: Library growth, curation, and organization.',
    color: '#06b6d4', // Cyan
    disciplines: [
      {
        id: 'collector',
        name: 'Collector',
        icon: 'Gamepad2',
        description: 'Add games to the database.',
        metric: 'total_games',
        tiers: [
          { level: 1, target: 1, title: 'Starter', xp: 50 },
          { level: 2, target: 50, title: 'Hobbyist', xp: 200 },
          { level: 3, target: 200, title: 'Curator', xp: 500 },
          { level: 4, target: 500, title: 'Preservationist', xp: 1000 },
          { level: 5, target: 1000, title: 'Library of Alexandria', xp: 2500 }
        ]
      },
      {
        id: 'taxonomist',
        name: 'Taxonomist',
        icon: 'Tags',
        description: 'Add Tags or Notes to your played sessions.',
        metric: 'tagged_sessions',
        tiers: [
          { level: 1, target: 1, title: 'Notetaker', xp: 50 },
          { level: 2, target: 20, title: 'Scribe', xp: 150 },
          { level: 3, target: 100, title: 'Chronicler', xp: 500 },
          { level: 4, target: 250, title: 'Historian', xp: 1000 },
          { level: 5, target: 500, title: 'Loremaster', xp: 2000 },
          { level: 6, target: 1000, title: 'Oracle', xp: 5000 }
        ]
      },
      {
        id: 'integrator',
        name: 'Integrator',
        icon: 'Network',
        description: 'Connect distinct store sources.',
        metric: 'distinct_sources',
        tiers: [
          { level: 1, target: 2, title: 'Dual Wielder', xp: 100 },
          { level: 2, target: 3, title: 'Triforce', xp: 250 },
          { level: 3, target: 4, title: 'Omni-Gamer', xp: 500 },
          { level: 4, target: 5, title: 'Nexus', xp: 1000 },
          { level: 5, target: 10, title: 'Singularity', xp: 2500 }
        ]
      },
      {
        id: 'purger',
        name: 'Purger',
        icon: 'Trash2',
        description: 'Drop games that aren\'t worth your time.',
        metric: 'dropped_games',
        tiers: [
          { level: 1, target: 5, title: 'Realist', xp: 50 },
          { level: 2, target: 10, title: 'Critic', xp: 150 },
          { level: 3, target: 25, title: 'Decisive', xp: 300 },
          { level: 4, target: 50, title: 'Ruthless', xp: 600 },
          { level: 5, target: 100, title: 'The Filter', xp: 1200 }
        ]
      },
      {
        id: 'fabricator',
        name: 'Fabricator',
        icon: 'PenTool',
        description: 'Manually add games to the library.',
        metric: 'manual_games_added',
        tiers: [
          { level: 1, target: 1, title: 'Penman', xp: 50 },
          { level: 2, target: 5, title: 'Author', xp: 150 },
          { level: 3, target: 10, title: 'Founder', xp: 300 },
          { level: 4, target: 25, title: 'Architect', xp: 600 },
          { level: 5, target: 50, title: 'Demiurge', xp: 1200 }
        ]
      },
      {
        id: 'librarian',
        name: 'Librarian',
        icon: 'BookMarked',
        description: 'Organize games with custom tags.',
        metric: 'games_with_tags',
        tiers: [
          { level: 1, target: 5, title: 'Labeler', xp: 50 },
          { level: 2, target: 25, title: 'Sorter', xp: 150 },
          { level: 3, target: 50, title: 'Cataloger', xp: 300 },
          { level: 4, target: 100, title: 'Dewey', xp: 600 },
          { level: 5, target: 200, title: 'SysAdmin', xp: 1200 }
        ]
      }
    ]
  },
  {
    id: 'critic',
    name: 'The Critic',
    icon: 'Feather',
    description: 'Focus: Analysis, journaling, and reviewing.',
    color: '#8b5cf6', // Violet
    disciplines: [
      {
        id: 'journalist',
        name: 'Journalist',
        icon: 'FileText',
        description: 'Write reviews with text notes',
        metric: 'text_reviews',
        tiers: [
          { level: 1, target: 1, title: 'Blogger', xp: 50 },
          { level: 2, target: 5, title: 'Columnist', xp: 200 },
          { level: 3, target: 10, title: 'Editor', xp: 500 },
          { level: 4, target: 25, title: 'Press Pass', xp: 1000 },
          { level: 5, target: 50, title: 'Pulitzer', xp: 2500 }
        ]
      },
      {
        id: 'analyst',
        name: 'Analyst',
        icon: 'BarChart2',
        description: 'Rate games (any review data).',
        metric: 'total_reviews',
        tiers: [
          { level: 1, target: 1, title: 'Rater', xp: 50 },
          { level: 2, target: 10, title: 'Reviewer', xp: 150 },
          { level: 3, target: 25, title: 'Metacritic', xp: 400 },
          { level: 4, target: 50, title: 'Tastemaker', xp: 800 },
          { level: 5, target: 100, title: 'The Standard', xp: 1600 }
        ]
      },
      {
        id: 'pundit',
        name: 'Pundit',
        icon: 'Scale',
        description: 'Review games using Critical Mode.',
        metric: 'critical_reviews',
        tiers: [
          { level: 1, target: 1, title: 'Skeptic', xp: 50 },
          { level: 2, target: 3, title: 'Cynic', xp: 150 },
          { level: 3, target: 5, title: 'Judge', xp: 300 },
          { level: 4, target: 10, title: 'Jury', xp: 600 },
          { level: 5, target: 25, title: 'Executioner', xp: 1200 }
        ]
      },
      {
        id: 'broadcaster',
        name: 'Broadcaster',
        icon: 'Share2',
        description: 'Generate Share Cards for games.',
        metric: 'shared_cards',
        tiers: [
          { level: 1, target: 1, title: 'Poster', xp: 50 },
          { level: 2, target: 5, title: 'Influencer', xp: 150 },
          { level: 3, target: 10, title: 'Trendsetter', xp: 300 },
          { level: 4, target: 25, title: 'Viral', xp: 600 },
          { level: 5, target: 50, title: 'Icon', xp: 1200 }
        ]
      }
    ]
  },
  {
    id: 'completionist',
    name: 'The Completionist',
    icon: 'Trophy',
    description: 'Focus: Mastery, achievements, and status.',
    color: '#eab308', // Yellow
    disciplines: [
      {
        id: 'finisher',
        name: 'Finisher',
        icon: 'CheckCircle',
        description: 'Mark games as Beaten.',
        metric: 'games_beat',
        tiers: [
          { level: 1, target: 1, title: 'Credits Roller', xp: 100 },
          { level: 2, target: 10, title: 'Campaigner', xp: 500 },
          { level: 3, target: 50, title: 'Veteran', xp: 1500 },
          { level: 4, target: 100, title: 'Hero', xp: 3000 },
          { level: 5, target: 200, title: 'Conqueror', xp: 6000 },
          { level: 6, target: 500, title: 'World Eater', xp: 10000 }
        ]
      },
      {
        id: 'perfectionist',
        name: 'Perfectionist',
        icon: 'Medal',
        description: 'Mark games as 100% Completed.',
        metric: 'games_completed',
        tiers: [
          { level: 1, target: 1, title: 'Shiny Object', xp: 200 },
          { level: 2, target: 5, title: 'Hunter', xp: 800 },
          { level: 3, target: 20, title: 'Platinum', xp: 2000 },
          { level: 4, target: 50, title: 'Flawless', xp: 5000 },
          { level: 5, target: 100, title: 'God Gamer', xp: 10000 },
          { level: 6, target: 200, title: 'Perfection', xp: 20000 }
        ]
      },
      {
        id: 'hoarder',
        name: 'Hoarder',
        icon: 'Container',
        description: 'Total achievements unlocked across all games.',
        metric: 'total_achievements',
        tiers: [
          { level: 1, target: 10, title: 'Scavenger', xp: 50 },
          { level: 2, target: 100, title: 'Gatherer', xp: 250 },
          { level: 3, target: 500, title: 'Stockpiler', xp: 1000 },
          { level: 4, target: 1000, title: 'Raider', xp: 2500 },
          { level: 5, target: 5000, title: 'Dragon', xp: 5000 },
          { level: 6, target: 10000, title: 'The Vault', xp: 10000 }
        ]
      },
      {
        id: 'titan',
        name: 'Titan',
        icon: 'Sword',
        description: 'Beat long games (Playtime > 30h).',
        metric: 'long_games_beaten',
        tiers: [
          { level: 1, target: 1, title: 'Slayer', xp: 200 },
          { level: 2, target: 3, title: 'Giant', xp: 600 },
          { level: 3, target: 5, title: 'Colossus', xp: 1200 },
          { level: 4, target: 10, title: 'Leviathan', xp: 2500 },
          { level: 5, target: 25, title: 'Titan', xp: 5000 }
        ]
      },
      {
        id: 'veteran',
        name: 'Veteran',
        icon: 'Repeat',
        description: 'Play sessions after beating a game.',
        metric: 'post_game_sessions',
        tiers: [
          { level: 1, target: 5, title: 'Returning Hero', xp: 100 },
          { level: 2, target: 20, title: 'New Game+', xp: 400 },
          { level: 3, target: 50, title: 'Loyalist', xp: 1000 },
          { level: 4, target: 100, title: 'Diehard', xp: 2000 },
          { level: 5, target: 200, title: 'Eternal', xp: 4000 }
        ]
      },
      {
        id: 'ascendant',
        name: 'Ascendant',
        icon: 'Crown',
        description: 'Total XP earned in Valis.',
        metric: 'total_xp',
        tiers: [
          { level: 1, target: 1000, title: 'Initiate', xp: 0 },
          { level: 2, target: 5000, title: 'Adept', xp: 0 },
          { level: 3, target: 15000, title: 'Master', xp: 0 },
          { level: 4, target: 30000, title: 'Grandmaster', xp: 0 },
          { level: 5, target: 50000, title: 'Ascended', xp: 0 }
        ]
      }
    ]
  },
  {
    id: 'timekeeper',
    name: 'The Timekeeper',
    icon: 'Watch',
    description: 'Focus: Playtime, consistency, and habits.',
    color: '#10b981', // Emerald
    disciplines: [
      {
        id: 'diver',
        name: 'Diver',
        icon: 'Anchor',
        description: 'Play for X hours in a single session.',
        metric: 'longest_session',
        tiers: [
          { level: 1, target: 1, title: 'Warming Up', xp: 50 },
          { level: 2, target: 4, title: 'In the Zone', xp: 200 },
          { level: 3, target: 8, title: 'Marathon', xp: 1000 },
          { level: 4, target: 12, title: 'No Life', xp: 2500 }
        ]
      },
      {
        id: 'loyalist',
        name: 'Loyalist',
        icon: 'Heart',
        description: 'Hours played on a single game (Valis Only).',
        metric: 'max_hours_one_game',
        tiers: [
          { level: 1, target: 10, title: 'Fan', xp: 100 },
          { level: 2, target: 50, title: 'Devotee', xp: 500 },
          { level: 3, target: 100, title: 'Main', xp: 1000 },
          { level: 4, target: 250, title: 'One Trick', xp: 2500 },
          { level: 5, target: 500, title: 'Soulbound', xp: 5000 }
        ]
      },
      {
        id: 'regular',
        name: 'Regular',
        icon: 'CalendarCheck',
        description: 'Daily login/play streak.',
        metric: 'current_streak',
        tiers: [
          { level: 1, target: 3, title: 'Casual', xp: 50 },
          { level: 2, target: 7, title: 'Weekender', xp: 150 },
          { level: 3, target: 14, title: 'Regular', xp: 300 },
          { level: 4, target: 30, title: 'Habit', xp: 600 },
          { level: 5, target: 100, title: 'Routine', xp: 2000 }
        ]
      },
      {
        id: 'operator',
        name: 'Operator',
        icon: 'Rocket',
        description: 'Launch games via Valis.',
        metric: 'launcher_starts',
        tiers: [
          { level: 1, target: 10, title: 'User', xp: 50 },
          { level: 2, target: 50, title: 'Pilot', xp: 200 },
          { level: 3, target: 200, title: 'Captain', xp: 500 },
          { level: 4, target: 500, title: 'Commander', xp: 1200 },
          { level: 5, target: 1000, title: 'Ace', xp: 2500 }
        ]
      },
      {
        id: 'eclectic',
        name: 'Eclectic',
        icon: 'Globe',
        description: 'Play distinct genres.',
        metric: 'unique_genres',
        tiers: [
          { level: 1, target: 3, title: 'Tourist', xp: 50 },
          { level: 2, target: 5, title: 'Explorer', xp: 150 },
          { level: 3, target: 10, title: 'Nomad', xp: 300 },
          { level: 4, target: 15, title: 'Renaissance', xp: 600 },
          { level: 5, target: 20, title: 'Universal', xp: 1200 }
        ]
      }
    ]
  }
];
