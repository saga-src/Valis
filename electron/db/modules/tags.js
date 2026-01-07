import { db } from '../client.js';

export async function saveGameTags(gameId, tagsString) {
  if (!tagsString) return;
  try {
    let tags = [];
    if (String(tagsString).startsWith('[')) {
      tags = JSON.parse(tagsString);
    } else {
      tags = String(tagsString).split(',').map(t => t.trim());
    }

    for (const tag of tags) {
      if (tag) {
        await db.insertInto('game_tags')
          .values({ game_id: String(gameId), tag_name: tag, usage_count: 1 })
          .onConflict(oc => oc
            .columns(['game_id', 'tag_name'])
            .doUpdateSet({ usage_count: (eb) => eb('usage_count', '+', 1) })
          )
          .execute();
      }
    }
  } catch (e) {
    console.error(`[DB] Error saving tags:`, e.message);
  }
}

export async function getGameTags(gameId) {
  const result = await db.selectFrom('game_tags')
    .select('tag_name')
    .where('game_id', '=', String(gameId))
    .orderBy('usage_count', 'desc')
    .limit(10)
    .execute();
  return result.map(row => row.tag_name);
}

export async function getAllUniqueTags() {
  const result = await db.selectFrom('game_tags')
    .select(({ fn }) => ['tag_name', fn.sum('usage_count').as('total_usage')])
    .groupBy('tag_name')
    .orderBy('total_usage', 'desc')
    .execute();
  return result.map(row => row.tag_name);
}