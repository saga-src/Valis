import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPendingRestore } from './services/RestoreBootstrap.js';

// This entry owns the single-instance lock and resolves restore before main.js can
// import db/client.js (which opens SQLite at module evaluation time).
// A deliberately narrow test hook keeps packaged restore smoke tests away from
// the user's real vault. It accepts only a dedicated directory under OS temp.
const testUserData = process.env.VALIS_TEST_USER_DATA_PATH;
if (testUserData) {
  const tempRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(testUserData);
  if (!path.isAbsolute(testUserData) ||
      !resolved.startsWith(`${tempRoot}${path.sep}`) ||
      !path.basename(resolved).startsWith('valis-smoke-')) {
    throw new Error('Invalid isolated Valis test profile');
  }
  fs.mkdirSync(resolved, { recursive: true });
  app.setPath('userData', resolved);
  app.setPath('sessionData', resolved);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    try {
      await applyPendingRestore(app.getPath('userData'));
      await import('./main.js');
    } catch (error) {
      console.error('[Restore] Startup stopped before opening the application:', error);
      app.exit(1);
    }
  });
}
