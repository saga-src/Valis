
import { ipcMain } from 'electron';
import * as db from '../db/modules/gamification.js';
import { emitDataChange } from '../services/DataChangeBus.js';

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
      emitDataChange({ type: 'gamification', source: 'getGamificationStatus:new-unlocks', important: true });
    }
    
    return data;
  });

  ipcMain.handle('unlockMark', async (event, markId) => {
      const result = await db.unlockMark(markId);
      if (result) emitDataChange({ type: 'gamification', source: 'unlockMark', ids: [markId], important: true });
      return result;
  });

  ipcMain.handle('addPlaytimeXP', async (event, amount) => {
      const result = await db.addPlaytimeXP(amount);
      if (Number(amount) > 0) emitDataChange({ type: 'gamification', source: 'addPlaytimeXP', important: true });
      return result;
  });
}
