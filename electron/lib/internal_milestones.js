
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
        name: 'The Collector',
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
        name: 'The Taxonomist',
        icon: 'Tags',
        description: 'Add Tags or Notes to your played sessions.',
        metric: 'tagged_sessions',
        tiers: [
          { level: 1, target: 1, title: 'Notetaker', xp: 50 },
          { level: 2, target: 20, title: 'Scribe', xp: 150 },
          { level: 3, target: 50, title: 'Chronicler', xp: 300 },
          { level: 4, target: 200, title: 'Historian', xp: 1000 },
          { level: 5, target: 500, title: 'Loremaster', xp: 2000 },
          { level: 6, target: 1000, title: 'Oracle', xp: 5000 }
        ]
      },
      {
        id: 'integrator',
        name: 'The Integrator',
        icon: 'Link',
        description: 'Import games from different sources.',
        metric: 'distinct_sources',
        tiers: [
          { level: 1, target: 2, title: 'Dual Wielder', xp: 100 },
          { level: 2, target: 3, title: 'Triforce', xp: 250 },
          { level: 3, target: 4, title: 'Omni-Gamer', xp: 500 },
          { level: 4, target: 5, title: 'Nexus', xp: 1000 },
          { level: 5, target: 10, title: 'Singularity', xp: 5000 }
        ]
      }
    ]
  },
  {
    id: 'critic',
    name: 'The Critic',
    icon: 'Star',
    description: 'Focus: Analysis, journaling, and reviewing.',
    color: '#a855f7', // Purple
    disciplines: [
      {
        id: 'journalist',
        name: 'The Journalist',
        icon: 'Newspaper',
        description: 'Write standard text reviews.',
        metric: 'total_reviews',
        tiers: [
          { level: 1, target: 1, title: 'Blogger', xp: 100 },
          { level: 2, target: 10, title: 'Columnist', xp: 500 },
          { level: 3, target: 20, title: 'Editor', xp: 1000 },
          { level: 4, target: 50, title: 'Pulitzer', xp: 2500 },
          { level: 5, target: 100, title: 'Publisher', xp: 5000 }
        ]
      },
      {
        id: 'analyst',
        name: 'The Analyst',
        icon: 'BarChart3',
        description: 'Complete Critical Analyses with weighted scores.',
        metric: 'critical_reviews',
        tiers: [
          { level: 1, target: 1, title: 'Observer', xp: 150 },
          { level: 2, target: 10, title: 'Specialist', xp: 600 },
          { level: 3, target: 20, title: 'Scholar', xp: 1200 },
          { level: 4, target: 50, title: 'Grand Jury', xp: 3000 },
          { level: 5, target: 100, title: 'Vindicator', xp: 6000 }
        ]
      },
      {
        id: 'broadcaster',
        name: 'The Broadcaster',
        icon: 'Megaphone',
        description: 'Generate Share Cards.',
        metric: 'shared_cards',
        tiers: [
          { level: 1, target: 1, title: 'The Voice', xp: 50 },
          { level: 2, target: 5, title: 'Herald', xp: 200 },
          { level: 3, target: 10, title: 'Influencer', xp: 500 },
          { level: 4, target: 20, title: 'Pundit', xp: 1000 },
          { level: 5, target: 50, title: 'Evangelist', xp: 2500 }
        ]
      }
    ]
  },
  {
    id: 'completionist',
    name: 'The Completionist',
    icon: 'Trophy',
    description: 'Focus: Finishing games and unlocking achievements.',
    color: '#eab308', // Yellow
    disciplines: [
      {
        id: 'finisher',
        name: 'The Finisher',
        icon: 'Flag',
        description: 'Mark games as "Beat" (Story Mode done).',
        metric: 'games_beat',
        tiers: [
          { level: 1, target: 1, title: 'Credits Roll', xp: 200 },
          { level: 2, target: 10, title: 'Campaigner', xp: 500 },
          { level: 3, target: 50, title: 'Veteran', xp: 1500 },
          { level: 4, target: 100, title: 'Conqueror', xp: 3000 },
          { level: 5, target: 500, title: 'World Eater', xp: 10000 }
        ]
      },
      {
        id: 'perfectionist',
        name: 'The Perfectionist',
        icon: 'Crown',
        description: 'Mark games as "Completed" (100% / Platinum).',
        metric: 'games_completed',
        tiers: [
          { level: 1, target: 1, title: 'Shiny Object', xp: 500 },
          { level: 2, target: 5, title: 'Hunter', xp: 2000 },
          { level: 3, target: 20, title: 'Platinum', xp: 5000 },
          { level: 4, target: 50, title: 'God Gamer', xp: 10000 },
          { level: 5, target: 100, title: 'Ascended', xp: 25000 }
        ]
      },
      {
        id: 'hoarder',
        name: 'The Hoarder',
        icon: 'Gem',
        description: 'Unlock individual achievements.',
        metric: 'total_achievements',
        tiers: [
          { level: 1, target: 10, title: 'Scavenger', xp: 50 },
          { level: 2, target: 50, title: 'Gatherer', xp: 200 },
          { level: 3, target: 100, title: 'Stockpiler', xp: 500 },
          { level: 4, target: 500, title: 'Raider', xp: 1500 },
          { level: 5, target: 1000, title: 'Dragon', xp: 3000 },
          { level: 6, target: 5000, title: 'The Vault', xp: 10000 }
        ]
      }
    ]
  },
  {
    id: 'timekeeper',
    name: 'The Timekeeper',
    icon: 'Timer',
    description: 'Focus: Time investment and dedication.',
    color: '#ef4444', // Red
    disciplines: [
      {
        id: 'diver',
        name: 'The Diver',
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
        name: 'The Loyalist',
        icon: 'Heart',
        description: 'Hours played on a single game.',
        metric: 'max_hours_one_game',
        tiers: [
          { level: 1, target: 10, title: 'Fan', xp: 100 },
          { level: 2, target: 50, title: 'Devotee', xp: 500 },
          { level: 3, target: 100, title: 'Main', xp: 1000 },
          { level: 4, target: 500, title: 'One Trick Pony', xp: 5000 },
          { level: 5, target: 1000, title: 'Soulbound', xp: 10000 }
        ]
      },
      {
        id: 'regular',
        name: 'The Regular',
        icon: 'CalendarCheck',
        description: 'Play on consecutive days.',
        metric: 'current_streak',
        tiers: [
          { level: 1, target: 2, title: 'Weekender', xp: 50 },
          { level: 2, target: 5, title: 'Routine', xp: 150 },
          { level: 3, target: 7, title: 'Daily Grinder', xp: 300 },
          { level: 4, target: 15, title: 'Dedicated', xp: 1000 },
          { level: 5, target: 30, title: 'Committed', xp: 2500 }
        ]
      }
    ]
  }
];
