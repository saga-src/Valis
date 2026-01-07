
import { ipcMain } from 'electron';
import * as db from '../db/modules/gamification.js';

export function registerGamificationHandlers() {
  ipcMain.handle('getGamificationStatus', async (event) => {
    const data = await db.getGamificationStatus();
    
    // Check for fresh unlocks and notify renderer
    if (data.newUnlocks && data.newUnlocks.length > 0) {
      data.newUnlocks.forEach(unlock => {
        // Safe navigation check
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('MILESTONE_UNLOCKED', {
            title: unlock.title,
            archetype: unlock.archetype_name,
            discipline: unlock.discipline_name, // Added for granular tracking
            level: unlock.level,
            xp: unlock.xp,
            maxRanks: unlock.maxRanks,
            iconName: unlock.icon
          });
        }
      });
    }
    
    return data;
  });

  ipcMain.handle('unlockMark', async (event, markId) => {
      return await db.unlockMark(markId);
  });

  ipcMain.handle('addPlaytimeXP', async (event, amount) => {
      return await db.addPlaytimeXP(amount);
  });
}
