import { db } from './client.js';

// ⚡ Re-exporting all modules to keep the API clean and compatible
export * from './modules/games.js';
export * from './modules/sessions.js';
export * from './modules/achievements.js';
export * from './modules/tags.js';
export * from './modules/settings.js';
export * from './modules/utils.js';
export * from './modules/gamification.js';
export * from './modules/statsSync.js';