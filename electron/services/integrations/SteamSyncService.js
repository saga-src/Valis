
import { fetchOwnedGames, fetchPlayerAchievements, fetchSteamProfile } from './SteamScraper.js';
import { addGame, getGameById, getLibrary } from '../../db/modules/games.js';
import { getSetting, getLinkedAccounts, saveLinkedAccount } from '../../db/modules/settings.js';
import { syncGameAchievements } from '../AchievementSync.js';
import { refreshSteamAchievements } from '../../db/modules/achievements.js';
import { resolveIgdbGame, fetchIGDBMetadata } from '../../lib/igdb.js';

export async function syncSteamLibrary(sender) {
  const apiKey = await getSetting('steam_api_key');
  
  if (!apiKey) {
    throw new Error('Steam Web API Key not configured.');
  }

  // Fetch all linked steam accounts
  let accounts = await getLinkedAccounts('steam');
  
  // Fallback for legacy single account setting if table is empty
  if (accounts.length === 0) {
      const legacyId = await getSetting('steam_user_id');
      if (legacyId) {
          accounts = [{ external_id: legacyId, platform: 'steam' }];
      }
  }

  if (accounts.length === 0) {
    throw new Error('No Steam accounts connected.');
  }

  let totalAdded = 0;
  let totalSynced = 0;
  let totalPlaytimeMinutes = 0;

  for (const account of accounts) {
      const steamId = account.external_id;
      const username = account.username || steamId;
      
      // Initial progress: 0/0 (Indeterminate)
      sender.send('steam:sync-progress', { message: `Syncing account: ${username}...`, current: 0, total: 0 });

      // 1. Fetch & Update Profile (Avatar/Name)
      try {
          console.log('[SteamSync] Updating Profile Data...');
          const profile = await fetchSteamProfile(steamId, apiKey);
          
          if (profile) {
              // Update the linked account record with fresh data
              await saveLinkedAccount({
                  ...account,
                  platform: 'steam', // Ensure platform is set for fallback accounts
                  username: profile.username,
                  avatar_url: profile.avatar
              });
              console.log(`[SteamSync] Updated profile for ${profile.username}`);
          }
      } catch (e) {
          console.warn('[SteamSync] Profile update failed:', e.message);
      }
      
      let steamGames = [];
      try {
        // Scraper now uses provided API key
        steamGames = await fetchOwnedGames(steamId, apiKey);
      } catch (e) {
        console.error(`Failed to fetch library for ${username}:`, e.message);
        continue; // Skip this account but continue with others
      }

      if (!steamGames || steamGames.length === 0) {
        continue;
      }

      const totalGames = steamGames.length;
      sender.send('steam:sync-progress', { message: `Found ${totalGames} games for ${username}. Processing...`, current: 0, total: totalGames });

      // --- SINGLE PASS LOOP ---
      for (let i = 0; i < totalGames; i++) {
        const steamGame = steamGames[i];
        const appId = String(steamGame.appid);
        
        // Update Progress
        sender.send('steam:sync-progress', { 
            message: `Processing: ${steamGame.name}`, 
            current: i + 1, 
            total: totalGames 
        });
        
        // 1. Resolve IGDB ID First
        const igdbId = await resolveIgdbGame(appId, steamGame.name);
        const resolvedId = igdbId ? String(igdbId) : appId;

        // 2. Fetch Existing Game by resolved ID
        const existingGame = await getGameById(resolvedId);

        // 3. Calculate Smart Playtime
        let legacyEntries = [];
        const steamSeconds = (steamGame.playtime_forever || 0) * 60;
        totalPlaytimeMinutes += (steamGame.playtime_forever || 0);

        if (existingGame) {
          // getGameById returns parsed array for legacy_playtime_seconds
          legacyEntries = existingGame.legacy_playtime_seconds || [];
          
          // Check if we already counted Steam for this specific game (Strict Source Match)
          const hasSteamSource = legacyEntries.some(e => 
            e.source?.toLowerCase().trim() === 'steam'
          );

          if (!hasSteamSource) {
            // New source for this game! Add Steam time to the existing pile
            legacyEntries.push({ source: 'Steam', platform_id: 99001, seconds: steamSeconds });
            console.log(`[SteamSync] Aggregating Steam time for: ${steamGame.name}`);
          } else {
            // Already synced. Keep current array (Steam time is already there)
            console.log(`[SteamSync] Steam source already exists for: ${steamGame.name}. Skipping playtime update.`);
          }
        } else {
          // Fresh import
          legacyEntries = [{ source: 'Steam', platform_id: 99001, seconds: steamSeconds }];
        }

        // 4. Upsert Logic using addGame (handles both fresh add and updates)
        let activeGameId = resolvedId;
        
        if (!existingGame) {
          console.log(`[SteamSync] Importing new game: ${steamGame.name} (${appId})`);
          
          if (igdbId) {
              const metadata = await fetchIGDBMetadata(igdbId);
              if (metadata) {
                await addGame({
                  ...metadata, 
                  id: String(igdbId),
                  steam_id: appId,
                  legacy_playtime_seconds: legacyEntries,
                  platform_ownership: [{ id: 99001, price: 0 }],
                  skip_achievement_scan: true // Suppress scan during sync to avoid individual spam
                });
              } else {
                await addGame({
                  id: String(igdbId),
                  name: steamGame.name,
                  steam_id: appId,
                  legacy_playtime_seconds: legacyEntries,
                  platform_ownership: [{ id: 99001, price: 0 }],
                  genres: [], involved_companies: [],
                  skip_achievement_scan: true
                });
              }
          } else {
              await addGame({
                id: appId,
                name: steamGame.name,
                steam_id: appId,
                legacy_playtime_seconds: legacyEntries,
                platform_ownership: [{ id: 99001, price: 0 }],
                genres: [], involved_companies: [],
                skip_achievement_scan: true
              });
          }
          totalAdded++;
        } else {
          // Update existing game with potential new playtime aggregation
          await addGame({
            ...existingGame,
            legacy_playtime_seconds: legacyEntries,
            // Ensure steam_id is linked if it was missing or resolved differently
            steam_id: appId,
            skip_achievement_scan: true
          });
        }

        // 5. Sync Achievements
        if (activeGameId) {
            try {
                const userAchievements = await fetchPlayerAchievements(steamId, appId, apiKey);
                
                if (userAchievements && userAchievements.length > 0) {
                    await refreshSteamAchievements(activeGameId, appId);

                    const mapped = userAchievements.map(ua => ({
                        id: ua.apiname,
                        unlocked: ua.achieved === 1,
                        unlockTime: ua.unlocktime * 1000
                    }));

                    const syncedCount = await syncGameAchievements(activeGameId, mapped);
                    if (syncedCount > 0) totalSynced += syncedCount;
                }
            } catch (e) {
                if (e.message && !e.message.includes('400')) { 
                    console.warn(`[SteamSync] Achievement error for ${steamGame.name}: ${e.message}`);
                }
            }
        }

        // 6. Rate Limiting
        await new Promise(r => setTimeout(r, 400));
      }
  }

  // 7. BATCH SOCIAL SIGNAL
  sender.send('SOCIAL_BROADCAST_SYNC', { platform: 'Steam', added: totalAdded, achievements: totalSynced });

  return { added: totalAdded, synced: totalSynced, playtimeMinutes: totalPlaytimeMinutes };
}
