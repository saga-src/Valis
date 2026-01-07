
import { dialog } from 'electron';
import { createRequire } from 'module';
import * as dbActions from '../db/queries.js';
import { rawDb } from '../db/client.js';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const INTERNAL_ID_MAP = {
  '99001': { id: '6', store: 'steam' },
  '99002': { id: '6', store: 'epic' },
  '99003': { id: '6', store: 'gog' },
  '99004': { id: '6', store: 'xbox' },
  '99005': { id: '6', store: 'standalone' },
  '99999': { id: '6', store: 'unofficial' },
  '100000': { id: '6', store: 'steam_tools' }
};

const processExcelTags = (gameId, tagsString, upsertStmt) => {
  if (!tagsString) return;
  try {
    let tags = [];
    if (String(tagsString).startsWith('[')) {
      tags = JSON.parse(tagsString);
    } else {
      tags = String(tagsString).split(',').map(t => t.trim());
    }
    tags.forEach(tag => {
      if (tag && tag.length > 0) {
        upsertStmt.run(String(gameId), tag);
      }
    });
  } catch (e) {
    console.error(`[Excel] Tag error for ${gameId}:`, e.message);
  }
};

export async function handleImportSessions() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Sessions (Excel)',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return { success: false, message: 'Cancelled' };

  try {
    const workbook = xlsx.readFile(filePaths[0]);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    const upsertTagStmt = rawDb.prepare(`
        INSERT INTO game_tags (game_id, tag_name, usage_count) 
        VALUES (?, ?, 1)
        ON CONFLICT(game_id, tag_name) 
        DO UPDATE SET usage_count = usage_count + 1
    `);

    let count = 0;
    let newGames = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const gameId = row[0] ? String(row[0]).trim() : null; 
      const rawPlatformInput = row[1] ? String(row[1]).trim() : 'unknown';
      const rawStart = row[2];
      const rawEnd = row[3];
      const rawDuration = row[4];
      const notes = row[5] ? String(row[5]) : null;
      const journal = row[6] ? String(row[6]) : null;

      if (!gameId || !rawStart) continue;

      const parseDate = (val) => {
        if (!val) return null;
        if (typeof val === 'number') return Math.round((val - 25569) * 86400 * 1000);
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.getTime();
      };

      const startTime = parseDate(rawStart);
      const endTime = parseDate(rawEnd) || Date.now();
      let duration = 0;
      if (startTime && endTime) duration = Math.max(0, Math.round((endTime - startTime) / 1000));
      if (duration === 0 && rawDuration) duration = Number(rawDuration);

      if (!startTime) continue;

      let platformId = 'unknown';
      let store = 'imported';
      if (INTERNAL_ID_MAP[rawPlatformInput]) {
        platformId = INTERNAL_ID_MAP[rawPlatformInput].id;
        store = INTERNAL_ID_MAP[rawPlatformInput].store;
      } else if (rawPlatformInput && rawPlatformInput.toLowerCase() !== 'unknown') {
        platformId = rawPlatformInput;
      }

      const pidToAdd = rawPlatformInput && rawPlatformInput.toLowerCase() !== 'unknown' 
          ? (String(rawPlatformInput).match(/^\d+$/) ? Number(rawPlatformInput) : rawPlatformInput)
          : null;

      let game = await dbActions.getGameById(gameId);
      if (!game) {
        await dbActions.addGame({
          id: gameId, 
          name: `Unknown Game (${gameId})`,
          platform_ownership: pidToAdd ? [{ id: pidToAdd, price: 0 }] : [],
          status: 'Backlog',
          added_at: Date.now()
        });
        newGames++;
      } else {
          // Ownership update logic
          let ownership = [];
          try { ownership = JSON.parse(game.platform_ownership || '[]'); } catch {}
          if (pidToAdd && !ownership.some(p => String(p.id) === String(pidToAdd))) {
              ownership.push({ id: pidToAdd, price: 0 });
              await dbActions.updateGame({ ...game, platform_ownership: ownership });
          }
      }

      if (notes) processExcelTags(gameId, notes, upsertTagStmt);

      await dbActions.importSession({
        id: crypto.randomUUID(),
        game_id: gameId,
        platform_id: pidToAdd,
        start_time: startTime,
        end_time: endTime,
        duration_seconds: duration,
        notes: notes,
        journal_text: journal
      });

      count++;
    }

    return { success: true, count, gamesCount: newGames };
  } catch (error) {
    console.error('Excel Import Failed:', error);
    return { success: false, message: error.message };
  }
}

export async function handleExportSessions() {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Sessions',
    defaultPath: 'sessions.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });

  if (canceled || !filePath) return { success: false, message: 'Cancelled' };

  try {
    const sessions = await dbActions.getAllSessions();
    const library = await dbActions.getLibrary();
    const gameMap = library.reduce((acc, g) => ({ ...acc, [g.id]: g }), {});

    const data = sessions.map(s => {
      const game = gameMap[s.game_id];
      return {
        'Game ID': s.game_id,
        'Platform ID': s.platform_id || (game ? (game.platform_id || 'unknown') : 'unknown'),
        'Start Time': new Date(s.start_time).toISOString(),
        'End Time': s.end_time ? new Date(s.end_time).toISOString() : '',
        'Duration (s)': s.duration_seconds,
        'Notes': s.notes || '',
        'Journal': s.journal_text || '',
        'Game Title': game ? game.title : 'Unknown'
      };
    });

    const sheet = xlsx.utils.json_to_sheet(data, { 
      header: ['Game ID', 'Platform ID', 'Start Time', 'End Time', 'Duration (s)', 'Notes', 'Journal', 'Game Title'] 
    });
    
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sessions');
    xlsx.writeFile(workbook, filePath);
    return { success: true };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, message: error.message };
  }
}
