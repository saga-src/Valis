
import { BrowserWindow } from 'electron';
import epicClient from './EpicClient.js';
import { addGame, getLibrary, getGameById } from '../../db/modules/games.js';
import { updateAchievementStatusByName } from '../../db/modules/achievements.js';
import { resolveIgdbGameByEpicSlug, fetchIGDBMetadata, searchIGDB } from '../../lib/igdb.js';
import { getLinkedAccounts } from '../../db/modules/settings.js';

// Helper to clean titles for better search results
function sanitizeTitle(title) {
    if (!title) return '';
    return title
        .replace(/®|™/g, '')       // Remove trademark symbols
        .replace(/Game of the Year Edition|GOTY/i, '') // Remove editions that confuse search
        .replace(/\s+/g, ' ')      // Collapse multiple spaces
        .trim();
}

// --- Date Parser (English) ---
function parseEpicDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    
    // Input format: "Unlocked Apr 20, 2023"
    const clean = dateStr.replace('Unlocked ', '').trim();
    
    // Native Date() works perfectly with English formats like "Apr 20, 2023"
    const dateObj = new Date(clean);
    
    if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
    }
    
    return new Date().toISOString(); // Fallback
}

export async function syncEpicLibrary(sender) {
  const window = BrowserWindow.fromWebContents(sender);
  sender.send('steam:sync-progress', { message: 'Initializing Visual Scraper...', current: 0, total: 0 });

  // 1. Get the Linked Account ID
  const accounts = await getLinkedAccounts('epic');
  const accountId = accounts.length > 0 ? accounts[accounts.length - 1].external_id : null;

  if (!accountId) {
      return { success: false, error: 'No linked Epic account found. Please connect via Settings.' };
  }

  let scrapedGames = [];
  try {
      // 2. Call the Client to scrape with progress sender
      scrapedGames = await epicClient.fetchLibrary(window, accountId, sender);
  } catch (e) {
      console.error('[EpicSync] Client error:', e);
      return { success: false, error: 'Scraping process failed.' };
  }

  if (scrapedGames.length === 0) {
      return { success: true, added: 0, message: 'No games found or empty list.' };
  }

  const totalGames = scrapedGames.length;
  let totalAdded = 0;
  let totalSyncedAchievements = 0;

  for (let i = 0; i < totalGames; i++) {
      const item = scrapedGames[i];
      const cleanTitle = sanitizeTitle(item.title);
      const epicSlug = item.id;
      
      // Update DB Progress (90% -> 100%)
      const dbPercent = 90 + Math.round((i / totalGames) * 10);
      sender.send('steam:sync-progress', { 
          message: `Importing to Vault: ${cleanTitle}`, 
          current: i + 1, 
          total: totalGames,
          percent: dbPercent
      });

      // 1. Resolve IGDB ID First
      let igdbId = null;
      try {
          igdbId = await resolveIgdbGameByEpicSlug(epicSlug);
      } catch (e) {
          console.warn('[EpicSync] Slug lookup warning:', e);
      }

      if (!igdbId) {
          const searchResults = await searchIGDB(cleanTitle);
          if (searchResults && searchResults.length > 0) {
              igdbId = searchResults[0].id;
          }
      }

      const resolvedId = igdbId ? String(igdbId) : `epic-${epicSlug}`;

      // 2. Fetch Existing Game by universal ID
      const existingGame = await getGameById(resolvedId);

      // 3. Calculate Smart Playtime
      let legacyEntries = [];
      const epicSeconds = (item.playtime_forever || 0) * 60;

      if (existingGame) {
        legacyEntries = existingGame.legacy_playtime_seconds || [];
        const hasEpicSource = legacyEntries.some(e => 
          e.source?.toLowerCase().trim() === 'epic'
        );

        if (!hasEpicSource && epicSeconds > 0) {
          legacyEntries.push({ source: 'Epic', platform_id: 99002, seconds: epicSeconds });
          console.log(`[EpicSync] Aggregating Epic time for: ${item.title}`);
        }
      } else {
        legacyEntries = epicSeconds > 0 ? [{ source: 'Epic', platform_id: 99002, seconds: epicSeconds }] : [];
      }

      // 4. Upsert Logic using addGame
      let activeGameId = resolvedId;
      
      if (!existingGame) {
          console.log(`[EpicSync] Importing new game: ${item.title} (${epicSlug})`);
          
          if (igdbId) {
              const metadata = await fetchIGDBMetadata(igdbId);
              if (metadata) {
                  await addGame({
                      ...metadata,
                      id: String(igdbId),
                      epic_id: epicSlug,
                      legacy_playtime_seconds: legacyEntries,
                      platform_ownership: [{ id: 99002, price: 0 }],
                      skip_achievement_scan: true
                  });
              } else {
                  await addGame({
                      id: String(igdbId),
                      name: item.title,
                      epic_id: epicSlug,
                      legacy_playtime_seconds: legacyEntries,
                      platform_ownership: [{ id: 99002, price: 0 }],
                      skip_achievement_scan: true
                  });
              }
          } else {
              await addGame({
                  id: resolvedId,
                  name: item.title,
                  epic_id: epicSlug,
                  legacy_playtime_seconds: legacyEntries,
                  platform_ownership: [{ id: 99002, price: 0 }],
                  skip_achievement_scan: true
              });
          }
          totalAdded++;
      } else {
          await addGame({
            ...existingGame,
            legacy_playtime_seconds: legacyEntries,
            epic_id: epicSlug,
            skip_achievement_scan: true
          });
      }

      // 5. Update Achievements
      if (activeGameId && item.unlockedAchievements && item.unlockedAchievements.length > 0) {
          console.log(`   -> Syncing ${item.unlockedAchievements.length} achievements for ${activeGameId}...`);
          for (const ach of item.unlockedAchievements) {
              const unlockDate = parseEpicDate(ach.rawDate);
              const success = await updateAchievementStatusByName(activeGameId, ach.name, unlockDate);
              if (success) totalSyncedAchievements++;
          }
      }
      
      // Throttle to be polite to IGDB
      await new Promise(r => setTimeout(r, 400));
  }

  // 6. BATCH SOCIAL SIGNAL
  sender.send('SOCIAL_BROADCAST_SYNC', { platform: 'Epic Games', added: totalAdded, achievements: totalSyncedAchievements });

  sender.send('steam:sync-progress', { message: 'Sync Complete!', percent: 100 });
  return { success: true, added: totalAdded, synced: totalSyncedAchievements };
}
