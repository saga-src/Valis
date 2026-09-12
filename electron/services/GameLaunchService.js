import fs from 'fs/promises';
import { spawn } from 'child_process';
import { getGameById } from '../db/modules/games.js';
import { incrementUserStat } from '../db/modules/gamification.js';
import { gameWatcher } from './ProcessWatcher.js';
import { GameLaunchCore } from './GameLaunchCore.js';

export const gameLaunchService = new GameLaunchCore({
  fs,
  spawn,
  getGameById,
  incrementUserStat,
  onStarted: (hint) => gameWatcher.addLaunchHint(hint)
});
