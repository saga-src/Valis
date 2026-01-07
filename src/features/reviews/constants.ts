
export interface ReviewPillar {
  id: string;
  label: string;
  description: string;
}

export const CRITICAL_PILLARS: ReviewPillar[] = [
  { id: 'game_design', label: 'Game Design', description: 'Systems, balance, loops, UI/UX, and innovation.' },
  { id: 'gameplay', label: 'Gameplay', description: 'Mechanics, controls, feel, difficulty curve, and fun factor.' },
  { id: 'narrative', label: 'Narrative', description: 'Story, dialogue, characters, pacing, and emotional impact.' },
  { id: 'worldbuilding', label: 'Worldbuilding', description: 'Lore, immersion, atmosphere, setting consistency.' },
  { id: 'visuals_fidelity', label: 'Visual Fidelity', description: 'Graphics tech, resolution, texture quality, effects.' },
  { id: 'art_direction', label: 'Art Direction', description: 'Style, creativity, aesthetic coherence, character design.' },
  { id: 'technical_polish', label: 'Technical Polish', description: 'Performance, frame rate, bugs, stability, loading times.' },
  { id: 'sound_design', label: 'Sound Design', description: 'SFX quality, spatial audio, voice acting, feedback.' },
  { id: 'soundtrack', label: 'Soundtrack', description: 'Music score quality, implementation, emotional fit.' }
];

export const CASUAL_CRITERIA: ReviewPillar[] = [
  { id: 'Gameplay', label: 'Gameplay', description: 'Is it actually fun? Does it feel good to play?' },
  { id: 'Graphics', label: 'Graphics', description: 'Does it look good? Is the art style cool?' },
  { id: 'Narrative', label: 'Narrative', description: 'Is the story interesting? Do you care about the characters?' },
  { id: 'Soundtrack', label: 'Soundtrack', description: 'Is the music good? Does it fit the vibe?' },
  { id: 'Audio Design', label: 'Audio Design', description: 'How does it sound? Is the atmosphere immersive?' }
];

// ⚡ KEYS ARE IGDB IDs (Matches your SQL Data)
export const GENRE_WEIGHTS: Record<string, Record<string, number>> = {
  'Standard': { 
    game_design: 3, gameplay: 4, narrative: 3, worldbuilding: 2,
    visuals_fidelity: 3, art_direction: 3, technical_polish: 2, sound_design: 2, soundtrack: 2
  },
  '2': { game_design: 5, gameplay: 2, narrative: 5, worldbuilding: 4, visuals_fidelity: 3, art_direction: 5, technical_polish: 2, sound_design: 3, soundtrack: 3 }, // Point-and-click
  '4': { game_design: 4, gameplay: 5, narrative: 2, worldbuilding: 2, visuals_fidelity: 4, art_direction: 4, technical_polish: 5, sound_design: 4, soundtrack: 4 }, // Fighting
  '5': { game_design: 4, gameplay: 5, narrative: 3, worldbuilding: 2, visuals_fidelity: 5, art_direction: 3, technical_polish: 5, sound_design: 5, soundtrack: 3 }, // Shooter
  '7': { game_design: 4, gameplay: 5, narrative: 2, worldbuilding: 2, visuals_fidelity: 4, art_direction: 3, technical_polish: 5, sound_design: 5, soundtrack: 5 }, // Music
  '8': { game_design: 5, gameplay: 5, narrative: 2, worldbuilding: 2, visuals_fidelity: 3, art_direction: 4, technical_polish: 3, sound_design: 3, soundtrack: 3 }, // Platform
  '9': { game_design: 5, gameplay: 2, narrative: 2, worldbuilding: 2, visuals_fidelity: 3, art_direction: 3, technical_polish: 1, sound_design: 2, soundtrack: 2 }, // Puzzle
  '10': { game_design: 4, gameplay: 5, narrative: 2, worldbuilding: 2, visuals_fidelity: 5, art_direction: 3, technical_polish: 4, sound_design: 5, soundtrack: 3 }, // Racing
  '11': { game_design: 5, gameplay: 3, narrative: 2, worldbuilding: 3, visuals_fidelity: 2, art_direction: 2, technical_polish: 4, sound_design: 2, soundtrack: 2 }, // RTS
  '12': { game_design: 5, gameplay: 4, narrative: 5, worldbuilding: 5, visuals_fidelity: 4, art_direction: 4, technical_polish: 3, sound_design: 4, soundtrack: 5 }, // RPG
  '13': { game_design: 3, gameplay: 5, narrative: 1, worldbuilding: 2, visuals_fidelity: 4, art_direction: 2, technical_polish: 5, sound_design: 4, soundtrack: 2 }, // Simulator
  '14': { game_design: 4, gameplay: 5, narrative: 2, worldbuilding: 2, visuals_fidelity: 5, art_direction: 2, technical_polish: 4, sound_design: 4, soundtrack: 3 }, // Sport
  '15': { game_design: 5, gameplay: 3, narrative: 2, worldbuilding: 3, visuals_fidelity: 2, art_direction: 2, technical_polish: 4, sound_design: 2, soundtrack: 2 }, // Strategy
  '16': { game_design: 5, gameplay: 3, narrative: 2, worldbuilding: 3, visuals_fidelity: 2, art_direction: 2, technical_polish: 4, sound_design: 2, soundtrack: 2 }, // Turn-based
  '24': { game_design: 5, gameplay: 3, narrative: 2, worldbuilding: 3, visuals_fidelity: 2, art_direction: 2, technical_polish: 4, sound_design: 2, soundtrack: 2 }, // Tactical
  '25': { game_design: 3, gameplay: 5, narrative: 3, worldbuilding: 2, visuals_fidelity: 4, art_direction: 3, technical_polish: 4, sound_design: 5, soundtrack: 5 }, // Hack and slash
  '26': { game_design: 5, gameplay: 2, narrative: 1, worldbuilding: 1, visuals_fidelity: 2, art_direction: 2, technical_polish: 1, sound_design: 2, soundtrack: 2 }, // Quiz
  '30': { game_design: 3, gameplay: 5, narrative: 1, worldbuilding: 1, visuals_fidelity: 2, art_direction: 3, technical_polish: 5, sound_design: 5, soundtrack: 2 }, // Pinball
  '31': { game_design: 3, gameplay: 3, narrative: 5, worldbuilding: 5, visuals_fidelity: 4, art_direction: 4, technical_polish: 2, sound_design: 4, soundtrack: 4 }, // Adventure
  '32': { game_design: 5, gameplay: 3, narrative: 3, worldbuilding: 3, visuals_fidelity: 2, art_direction: 5, technical_polish: 2, sound_design: 3, soundtrack: 4 }, // Indie
  '33': { game_design: 4, gameplay: 5, narrative: 1, worldbuilding: 1, visuals_fidelity: 2, art_direction: 3, technical_polish: 2, sound_design: 5, soundtrack: 4 }, // Arcade
  '34': { game_design: 3, gameplay: 1, narrative: 5, worldbuilding: 5, visuals_fidelity: 2, art_direction: 5, technical_polish: 1, sound_design: 2, soundtrack: 4 }, // Visual Novel
  '35': { game_design: 5, gameplay: 3, narrative: 2, worldbuilding: 3, visuals_fidelity: 2, art_direction: 4, technical_polish: 1, sound_design: 2, soundtrack: 2 }, // Card & Board
  '36': { game_design: 5, gameplay: 5, narrative: 2, worldbuilding: 3, visuals_fidelity: 3, art_direction: 3, technical_polish: 5, sound_design: 4, soundtrack: 2 }  // MOBA
};

export const SCORE_SUGGESTIONS = [
  { min: 6.8, label: 'Masterpiece / Perfect', range: '9.5 - 10.0' },
  { min: 5.8, label: 'Excellent', range: '8.0 - 8.5 - 9.0' },
  { min: 4.8, label: 'Good / Solid', range: '6.5 - 7.0 - 7.5' },
  { min: 3.8, label: 'Average / Acceptable', range: '5.0 - 5.5 - 6.0' },
  { min: 2.8, label: 'Weak / Dated', range: '3.5 - 4.0 - 4.5' },
  { min: 1.8, label: 'Bad', range: '2.0 - 2.5 - 3.0' },
  { min: 0.0, label: 'Terrible / Broken', range: '0.5 - 1.0 - 1.5' }
];
