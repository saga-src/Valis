import { ipcMain } from 'electron';
import { db, rawDb } from '../db/client.js';

export function registerTagHandlers() {
  // Get all available tags
  ipcMain.handle('tags:get', async () => {
    return await db.selectFrom('tags').selectAll().execute();
  });

  // Create a new tag
  ipcMain.handle('tags:create', async (event, { name, color }) => {
    const result = await db.insertInto('tags')
      .values({ name, color: color || '#ffffff' })
      .executeTakeFirst();
    return { success: true, id: Number(result.insertId) };
  });

  // Update a tag
  ipcMain.handle('tags:update', async (event, { id, name, color }) => {
    await db.updateTable('tags')
      .set({ name, color })
      .where('id', '=', id)
      .execute();
    return { success: true };
  });

  // Delete a tag (cascades to links)
  ipcMain.handle('tags:delete', async (event, id) => {
    await db.deleteFrom('tags').where('id', '=', id).execute();
    return { success: true };
  });

  // Link a tag to a game
  ipcMain.handle('tags:tag-game', async (event, { gameId, tagId }) => {
    try {
      await db.insertInto('game_library_tags')
        .values({ game_id: String(gameId), tag_id: Number(tagId) })
        .execute();
      return { success: true };
    } catch (e) {
      // Ignore unique constraint errors (already tagged)
      return { success: true };
    }
  });

  // Unlink a tag from a game
  ipcMain.handle('tags:untag-game', async (event, { gameId, tagId }) => {
    await db.deleteFrom('game_library_tags')
      .where('game_id', '=', String(gameId))
      .where('tag_id', '=', Number(tagId))
      .execute();
    return { success: true };
  });

  // Bulk set tags for a game (Wipe & Rewrite)
  ipcMain.handle('tags:set-game-tags', async (event, { gameId, tagIds }) => {
    return await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('game_library_tags')
        .where('game_id', '=', String(gameId))
        .execute();
      
      if (tagIds && tagIds.length > 0) {
        const values = tagIds.map(id => ({
          game_id: String(gameId),
          tag_id: Number(id)
        }));
        await trx.insertInto('game_library_tags').values(values).execute();
      }
      return { success: true };
    });
  });
}
