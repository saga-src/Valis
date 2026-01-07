
export const SCORE_LABELS: Record<string, Record<number, string>> = {
  // --- CASUAL CRITERIA ---
  'Gameplay': {
    7: 'Addictive', 6: 'Excellent', 5: 'Good', 
    4: 'Reasonable / Nothing special', 3: 'Bad', 2: 'Terrible', 1: 'Avoid playing'
  },
  'Graphics': {
    7: 'Masterpiece', 6: 'Beautiful', 5: 'Pretty', 
    4: 'Mediocre', 3: 'Ugly', 2: 'Horrible', 1: 'Atrocious'
  },
  'Narrative': {
    7: 'Magnificent', 6: 'Excellent', 5: 'Good', 
    4: 'Reasonable / Nothing special', 3: 'Bad', 2: 'Terrible', 1: 'Laughably bad'
  },
  'Soundtrack': {
    7: 'Sensational', 6: 'Excellent', 5: 'Good', 
    4: 'Reasonable / Nothing special', 3: 'Disconnected', 2: 'Bad', 1: 'Irritating'
  },
  'Audio Design': {
    7: 'Eargasm', 6: 'Excellent', 5: 'Good', 
    4: 'Reasonable / Nothing special', 3: 'Bad', 2: 'Terrible', 1: 'Play without headphones'
  },

  // --- CRITICAL PILLARS ---
  'game_design': {
    7: 'Design Masterclass / Genre Defining', 6: 'Intelligent and very well structured', 5: 'Well planned',
    4: 'Industry standard (functional)', 3: 'Confusing or repetitive', 2: 'Poorly planned / Frustrating', 1: 'Nonsensical / Broken'
  },
  'gameplay': {
    7: 'Addictive / Extreme fluidity', 6: 'Excellent and responsive', 5: 'Good and solid',
    4: 'Functional (nothing special)', 3: 'Clunky / Dated', 2: 'Bad / Slow response', 1: 'Unplayable'
  },
  'narrative': {
    7: 'Literary Masterpiece', 6: 'Engaging and emotional', 5: 'Good story',
    4: 'Cliché / Average Movie', 3: 'Weak / Uninteresting', 2: 'Bad / Cringe dialogues', 1: 'Offensive / Non-existent'
  },
  'worldbuilding': {
    7: 'A living and fascinating world', 6: 'Rich in detail and immersion', 5: 'Interesting universe',
    4: 'Generic setting', 3: 'Empty or inconsistent world', 2: 'Uninspired', 1: 'Cardboard scenery'
  },
  'visuals_fidelity': {
    7: 'Visual Benchmark (Next-gen)', 6: 'Impressive', 5: 'Beautiful / Current',
    4: 'Average / Acceptable', 3: 'Outdated', 2: 'Ugly (low res/aliasing)', 1: 'Looks like 3 generations ago'
  },
  'art_direction': {
    7: 'Unique Visual Identity / Artistic', 6: 'Stylish and cohesive', 5: 'Very artistically beautiful',
    4: 'Competent', 3: 'Generic / Asset flip feel', 2: 'No identity / Confusing', 1: 'Eyesore (bad colors/UI)'
  },
  'technical_polish': {
    7: 'State of the Art (Revolutionary)', 6: 'Robust and modern', 5: 'Good features',
    4: 'Basic functional', 3: 'Limited AI or Physics', 2: 'Primitive features', 1: 'Archaic'
  },
  'sound_design': {
    7: 'Eargasm / Total immersion', 6: 'Impactful sound design', 5: 'Good and crisp',
    4: 'Reasonable', 3: 'Repetitive or "canned"', 2: 'Bad mixing', 1: 'Flawed / Silent'
  },
  'soundtrack': { // Critical version (reusing key since text is similar but context differs slightly, sticking to manual)
    7: 'Legendary / Goes to playlist', 6: 'Excellent and memorable', 5: 'Good, fits the game',
    4: 'Forgettable (job done)', 3: 'Generic / Out of place', 2: 'Bad / Annoying', 1: 'Irritating (Mute)'
  }
};
