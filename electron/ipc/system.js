import { ipcMain, Notification, app } from 'electron';
import { handleImportSessions, handleExportSessions } from '../lib/excel.js';
import FactoryResetService from '../services/FactoryResetService.js';
import path from 'path';
import si from 'systeminformation';
import { db } from '../db/client.js';

// Define all tables that contain user data.
// ORDER MATTERS: Children (tables with foreign keys) must come before Parents.
const ALL_USER_TABLES = [
  'achievement_progress', // FK -> achievements, sessions
  'achievements',         // FK -> games
  'sessions',             // FK -> games
  'game_tags',            // FK -> games
  'library_platforms',    // FK -> games
  'library',              // FK -> games
  'unlocked_tiers',
  'unlocked_marks',
  'user_stats',
  'linked_accounts',      // Critical: Auth tokens
  'watch_paths',
  'settings',
  'games'                 // Parent
];

export function registerSystemHandlers() {
  // Excel Import
  ipcMain.handle('excel:import-sessions', async () => {
    return await handleImportSessions();
  });

  // Excel Export
  ipcMain.handle('excel:export-sessions', async () => {
    return await handleExportSessions();
  });

  // Factory Reset
  ipcMain.handle('system:factory-reset', async (event, options) => {
    try {
      return await FactoryResetService.performReset(options);
    } catch (error) {
      console.error('Factory reset error:', error);
      return { success: false, error: error.message };
    }
  });

  // Test Notification
  ipcMain.on('test-notification', (event, config) => {
    const { toast = true, sound = true } = config || {};
    const iconPath = path.join(process.cwd(), 'public', 'images', 'trophy.png');

    if (toast) {
      new Notification({
        title: 'System Test',
        body: 'Telemetry sensors are active. Achievement tracking is online.',
        silent: true,
        icon: iconPath
      }).show();
    }

    if (sound && event && event.sender) {
      event.sender.send('play-sound', 'achievement');
    }
  });

  // Hardware Monitor
  ipcMain.handle('get-system-stats', async () => {
    try {
      const [cpu, mem, graphics] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.graphics()
      ]);

      const cpuLoad = Math.round(cpu.currentLoad || 0);
      let activeGpu = graphics.controllers.find(c => typeof c.utilizationGpu === 'number');

      if (!activeGpu) {
          activeGpu = graphics.controllers[0] || { model: 'Generic GPU', utilizationGpu: 0 };
      }

      return {
        cpuLoad: cpuLoad,
        memUsed: Math.round((mem.active / mem.total) * 100),
        memTotal: Math.round(mem.total / 1073741824),
        gpuLoad: Math.round(activeGpu.utilizationGpu || 0),
        gpuName: activeGpu.model || 'Integrated Graphics'
      };
    } catch (e) {
      console.error('[System] Stats Error:', e);
      return { cpuLoad: 0, memUsed: 0, gpuLoad: 0, gpuName: 'N/A' };
    }
  });

  // System Metadata
  ipcMain.handle('system:get-meta', async () => {
    const rows = await db.selectFrom('system_meta').selectAll().execute();
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  });

  ipcMain.handle('system:set-meta', async (event, key, value) => {
    await db
      .insertInto('system_meta')
      .values({ key, value })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute();
    return { success: true };
  });

  // 1. Full Database Dump (Backup / Sync Upload)
  ipcMain.handle('system:get-database-dump', async () => {
    const data = {};
    // Loop through all tables and fetch their data
    for (const table of ALL_USER_TABLES) {
      data[table] = await db.selectFrom(table).selectAll().execute();
    }
    return { data };
  });

  // 2. Restore Backup (Sync Download / Manual Restore)
  ipcMain.handle('system:restore-backup', async (event, jsonData) => {
    try {
      await db.transaction().execute(async (trx) => {
        // A. Wipe all tables first (in dependency order)
        for (const table of ALL_USER_TABLES) {
          await trx.deleteFrom(table).execute();
        }

        // B. Restore from JSON (Parents first, so reverse the dependency list)
        if (jsonData) {
            const INSERT_ORDER = [...ALL_USER_TABLES].reverse(); 
            
            for (const table of INSERT_ORDER) {
                if (jsonData[table] && jsonData[table].length > 0) {
                    const rows = jsonData[table];
                    // Chunk inserts to prevent SQLite variable limit errors
                    const CHUNK_SIZE = 50; 
                    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                        await trx.insertInto(table).values(rows.slice(i, i + CHUNK_SIZE)).execute();
                    }
                }
            }
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Restore failed:', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Wipe User Data (Logout / Account Switch)
  ipcMain.handle('system:wipe-user-data', async () => {
    try {
        await db.transaction().execute(async (trx) => {
            // Delete from every table in the dependency list
            for (const table of ALL_USER_TABLES) {
                await trx.deleteFrom(table).execute();
            }
            
            // Reset System Metadata (Owner & Sync Time)
            // We use delete here to reset, init.js will re-seed defaults if needed or next login will set them
            await trx.deleteFrom('system_meta')
              .where('key', 'in', ['owner_id', 'last_synced_at'])
              .execute();
        });
        return { success: true };
    } catch (error) {
        console.error('Wipe failed:', error);
        return { success: false, error: error.message };
    }
  });

  // Startup Handlers
  ipcMain.handle('system:get-startup-status', async () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('system:toggle-startup', async (event, payload) => {
    app.setLoginItemSettings({
      openAtLogin: payload,
      path: app.getPath('exe'),
      args: ['--process-start-args', '--startup']
    });
    return app.getLoginItemSettings().openAtLogin;
  });
}