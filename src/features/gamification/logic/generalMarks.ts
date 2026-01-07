
export interface GeneralMark {
  id: string;
  title: string;
  lore: string; // Always visible
  trigger: string; // Hidden until unlocked
  visual: 'stealth' | 'light' | 'holo' | 'neon' | 'void' | 'thermal' | 'glitch' | 'retro' | 'glass' | 'organic' | 'chrome' | 'gold';
  iconName: string; // Added icon mapping
}

export const GENERAL_MARKS: GeneralMark[] = [
  // --- NAVIGATOR SECTOR ---
  {
    id: 'the_ghost',
    title: 'The Ghost',
    lore: 'You have become one with the shadows. Visual signature: Null.',
    trigger: 'Accumulate 50 Hours of active runtime in Stealth Mode.',
    visual: 'stealth',
    iconName: 'Ghost'
  },
  {
    id: 'the_daywalker',
    title: 'The Daywalker',
    lore: 'Returning to the surface. Ocular adjustment required.',
    trigger: 'Switch back to Light Mode after 4+ consecutive hours in Stealth.',
    visual: 'light',
    iconName: 'Sun'
  },
  {
    id: 'the_cartographer',
    title: 'The Cartographer',
    lore: 'Map synchronization complete. All sectors charted.',
    trigger: 'Visit every major page (Dashboard, Library, etc.) in one session.',
    visual: 'holo',
    iconName: 'Globe'
  },
  {
    id: 'the_filter',
    title: 'The Filter',
    lore: 'Refining the dataset. Noise eliminated.',
    trigger: 'Apply 3 active filters simultaneously.',
    visual: 'neon',
    iconName: 'Filter'
  },
  {
    id: 'the_abyss',
    title: 'The Abyss',
    lore: 'You have stared into the deep data. It stares back.',
    trigger: 'Scroll to the absolute bottom of a 500+ game library.',
    visual: 'void',
    iconName: 'Eye'
  },

  // --- CHRONOMANCER SECTOR ---
  {
    id: 'the_night_owl',
    title: 'The Night Owl',
    lore: 'The veil is thinnest in the early hours. Activity detected.',
    trigger: 'Interact with Valis between 01:00 AM and 05:00 AM.',
    visual: 'void',
    iconName: 'Moon'
  },
  {
    id: 'the_constant',
    title: 'The Constant',
    lore: 'Temporal synchronization stable. The pulse is steady.',
    trigger: 'Open Valis for 7 consecutive days.',
    visual: 'neon',
    iconName: 'Infinity'
  },
  {
    id: 'the_marathon',
    title: 'The Marathon',
    lore: 'Warning overrides disabled. Endurance mode engaged.',
    trigger: 'Ignore a "Touch Grass" alert and continue playing for 1 hour.',
    visual: 'thermal',
    iconName: 'BatteryWarning'
  },

  // --- ANNOTATOR SECTOR ---
  {
    id: 'the_labeler',
    title: 'The Labeler',
    lore: 'Categorizing the experience. Memory indexing complete.',
    trigger: 'Add manual tags to 50 different sessions.',
    visual: 'neon',
    iconName: 'Tag'
  },
  {
    id: 'the_scribe',
    title: 'The Scribe',
    lore: 'Detailed analysis archived. History preserved.',
    trigger: 'Write a session note longer than 500 characters.',
    visual: 'holo',
    iconName: 'Feather'
  },
  {
    id: 'the_emotionalist',
    title: 'The Emotionalist',
    lore: 'Data implies feeling. The machine learns empathy.',
    trigger: 'Log a Mood in 10 consecutive sessions.',
    visual: 'glass',
    iconName: 'Smile'
  },

  // --- INTEGRATOR SECTOR ---
  {
    id: 'the_neural_handshake',
    title: 'The Neural Handshake',
    lore: 'External data stream established. The Protocol is expanding.',
    trigger: 'Successfully import your first external library.',
    visual: 'holo',
    iconName: 'Unplug'
  },
  {
    id: 'the_trinity',
    title: 'The Trinity',
    lore: 'Three rivers flowing into one ocean. Total convergence.',
    trigger: 'Maintain active connections to 3 different sources.',
    visual: 'glass',
    iconName: 'Triangle'
  },

  // --- AESTHETE SECTOR ---
  {
    id: 'the_gallerist',
    title: 'The Gallerist',
    lore: 'Appreciating the artifact, not just the function.',
    trigger: 'Spend 1 hour total viewing library in Museum Mode.',
    visual: 'glass',
    iconName: 'Frame'
  },
  {
    id: 'the_accountant',
    title: 'The Accountant',
    lore: 'Pure data. No distractions. The matrix revealed.',
    trigger: 'Keep Data View open for 30 minutes in one session.',
    visual: 'retro',
    iconName: 'Table'
  },

  // --- MACHINE SECTOR ---
  {
    id: 'the_overclocker',
    title: 'The Overclocker',
    lore: 'Monitoring vital signs. System integrity: 100%.',
    trigger: 'Play a game while Hardware Monitor is pinned.',
    visual: 'thermal',
    iconName: 'Cpu'
  },
  {
    id: 'the_bottleneck',
    title: 'The Bottleneck',
    lore: 'Pushing the limits of physical memory.',
    trigger: 'Launch a game when RAM usage is above 90%.',
    visual: 'thermal',
    iconName: 'Gauge'
  },
  {
    id: 'the_archaeologist',
    title: 'The Archaeologist',
    lore: 'Digging through the code of ancients. Retro-compatibility achieved.',
    trigger: 'Unlock an achievement via Local Emulator Watcher.',
    visual: 'retro',
    iconName: 'Pickaxe'
  },

  // --- GLITCH SECTOR ---
  {
    id: 'ghost_in_the_machine',
    title: 'Ghost in the Machine',
    lore: 'You knocked. The system answered.',
    trigger: 'Click the Valis logo 10 times rapidly.',
    visual: 'glitch',
    iconName: 'Bot'
  },
  {
    id: 'the_1337',
    title: 'The 1337',
    lore: 'Elite status confirmed.',
    trigger: 'Reach exactly 1337 games in your database.',
    visual: 'retro',
    iconName: 'Terminal'
  },
  {
    id: 'architects_signature',
    title: 'The Architect\'s Signature',
    lore: 'Accessing developer console... [Access Denied].',
    trigger: 'Click the Version Number 5 times.',
    visual: 'glitch',
    iconName: 'Code'
  },
  {
    id: 'the_oracle',
    title: 'The Oracle',
    lore: 'Surrendering control to the algorithm.',
    trigger: 'Use "Pick Random Game" 10 times.',
    visual: 'holo',
    iconName: 'Dice6'
  },
  {
    id: 'the_loop',
    title: 'The Loop',
    lore: 'Déjà vu detected. Memory corruption imminent.',
    trigger: 'Click the same game card 5 times in a row.',
    visual: 'glitch',
    iconName: 'Repeat'
  },
  {
    id: 'the_echo',
    title: 'The Echo',
    lore: 'Query returned void. Silence detected.',
    trigger: 'Perform a search query that returns 0 results.',
    visual: 'void',
    iconName: 'Radar'
  },

  // --- EGO SECTOR ---
  {
    id: 'the_mirror',
    title: 'The Mirror',
    lore: 'Self-reflection is the first step to optimization.',
    trigger: 'Visit your own Profile Page 50 times.',
    visual: 'chrome',
    iconName: 'User'
  },
  {
    id: 'the_identity',
    title: 'The Identity',
    lore: 'Personality core stabilized.',
    trigger: 'Keep the same Archetype dominant for 30 days.',
    visual: 'gold',
    iconName: 'Fingerprint'
  },
  {
    id: 'touch_grass',
    title: 'Touch Grass',
    lore: 'Compliance with health protocols verified. Disconnecting.',
    trigger: 'Trigger a "Touch Grass" alert and close the app.',
    visual: 'organic',
    iconName: 'Leaf'
  }
];
