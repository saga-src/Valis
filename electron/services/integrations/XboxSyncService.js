
import { BrowserWindow } from 'electron';
import xboxAuth from './XboxAuthService.js';
import xboxClient from './XboxClient.js';
import { addGame, getLibrary, getGameById } from '../../db/modules/games.js';
import { fetchIGDBMetadata, fetchIGDBGameByExternalUid, searchIGDB } from '../../lib/igdb.js';
import { saveLinkedAccount, getLinkedAccounts } from '../../db/modules/settings.js';
import { savePsnAchievements, getGameAchievements, updateAchievementStatusByName } from '../../db/modules/achievements.js';

// Map our internal tags to your Database Platform IDs
const PLATFORM_MAP = {
    'xbox_360': 12,      // IGDB ID for Xbox 360
    'xbox_one': 49,      // IGDB ID for Xbox One
    'xbox_series': 169,  // IGDB ID for Xbox Series X|S
    'xbox_app_pc': 99004 // Internal ID for PC via Xbox Store
};

export async function linkXboxAccount(sender) {
    const window = BrowserWindow.fromWebContents(sender);
    
    try {
        console.log('[XboxLink] Starting new login flow...');
        // 1. Perform the OAuth Dance (User Interaction)
        const auth = await xboxAuth.login(window);
        
        // 2. Save the credentials to DB
        // Note: XSTS tokens expire quickly. In a robust app, we'd need refresh tokens. 
        // For now, re-linking is required if token expires.
        await saveLinkedAccount({
            platform: 'xbox',
            external_id: auth.xid,        // Xbox User ID
            username: auth.gamertag,      // Gamertag
            avatar_url: auth.avatarUrl,   // Profile Picture
            auth_data: JSON.stringify({
                xstsToken: auth.xstsToken,
                userHash: auth.userHash,
                expiry: Date.now() + (1000 * 60 * 60 * 4) // Approx 4 hours
            }),
            created_at: Date.now()
        });

        console.log(`[XboxLink] Account linked: ${auth.gamertag}`);
        return { success: true, username: auth.gamertag };
    } catch (error) {
        console.error('[XboxLink] Failed:', error);
        return { success: false, error: error.message };
    }
}

export async function syncXboxLibrary(sender) {
    sender.send('steam:sync-progress', { message: 'Initializing Xbox Sync...', current: 0, total: 0 });

    try {
        // 1. Load credentials from DB
        const accounts = await getLinkedAccounts('xbox');
        const account = accounts[0]; 
        
        if (!account) return { success: false, error: "No Xbox account linked. Please connect first." };

        const authData = JSON.parse(account.auth_data);
        // Check expiry (basic check)
        if (authData.expiry && Date.now() > authData.expiry) {
             return { success: false, error: "Xbox session expired. Please re-connect." };
        }

        sender.send('steam:sync-progress', { message: `Fetching games for ${account.username}...`, current: 0, total: 0 });

        // 2. Fetch Games (Filtered by Client)
        const xboxGames = await xboxClient.fetchLibrary(authData.xstsToken, authData.userHash, account.external_id);
        
        if (!xboxGames || xboxGames.length === 0) {
            return { success: true, added: 0, message: 'No valid Xbox games found.' };
        }

        const totalGames = xboxGames.length;
        sender.send('steam:sync-progress', { message: `Found ${totalGames} valid titles. Importing...`, current: 0, total: totalGames });

        let addedCount = 0;
        let totalPlaytimeSeconds = 0;

        for (let i = 0; i < totalGames; i++) {
            const game = xboxGames[i];
            
            // Send progress update
            sender.send('steam:sync-progress', { 
                message: `Processing: ${game.name}`, 
                current: i + 1, 
                total: totalGames 
            });

            // 1. Resolve Universal ID
            let igdbId = null;
            if (game.xboxStoreId) {
                try {
                    igdbId = await fetchIGDBGameByExternalUid([11, 54], game.xboxStoreId);
                } catch (e) { /* ignore */ }
            }
            if (!igdbId && game.xboxMarketId) {
                try {
                    igdbId = await fetchIGDBGameByExternalUid(31, game.xboxMarketId);
                } catch (e) { /* ignore */ }
            }
            if (!igdbId) {
                const searchResults = await searchIGDB(game.name);
                if (searchResults && searchResults.length > 0) {
                    igdbId = searchResults[0].id;
                }
            }

            const resolvedId = igdbId ? String(igdbId) : `xbox-${game.xboxMarketId || game.legacyId || Date.now()}`;

            // 2. Fetch Existing Game by universal ID
            const existingGame = await getGameById(resolvedId);

            // 3. Calculate Smart Playtime & Platforms
            let legacyEntries = [];
            const xboxSeconds = game.playtimeSeconds || 0;
            totalPlaytimeSeconds += xboxSeconds;

            if (existingGame) {
              legacyEntries = existingGame.legacy_playtime_seconds || [];
              
              // Check if we already counted Xbox for this specific game (Strict Source Match)
              const hasXboxSource = legacyEntries.some(e => 
                e.source?.toLowerCase().trim() === 'xbox'
              );

              if (!hasXboxSource && xboxSeconds > 0) {
                legacyEntries.push({ source: 'Xbox', platform_id: 99004, seconds: xboxSeconds });
                console.log(`[XboxSync] Aggregating Xbox time for: ${game.name}`);
              }
            } else {
              legacyEntries = xboxSeconds > 0 ? [{ source: 'Xbox', platform_id: 99004, seconds: xboxSeconds }] : [];
            }

            let platformOwnership = [];
            if (game.platforms && Array.isArray(game.platforms)) {
                platformOwnership = game.platforms
                    .map(pTag => PLATFORM_MAP[pTag])
                    .filter(id => id !== undefined)
                    .map((id) => ({ id: id, price: 0 }));
            }
            if (platformOwnership.length === 0) {
                platformOwnership.push({ id: 49, price: 0 }); 
            }

            // 4. Upsert Logic using addGame
            let activeGameId = resolvedId;
            
            if (!existingGame) {
                console.log(`[XboxSync] Importing new game: ${game.name}`);
                
                const gameData = {
                    id: resolvedId,
                    name: game.name,
                    status: 'Backlog',
                    xbox_store_id: game.xboxStoreId,
                    xbox_market_id: game.xboxMarketId,
                    legacy_playtime_seconds: legacyEntries,
                    platform_ownership: platformOwnership
                };

                if (igdbId) {
                    const metadata = await fetchIGDBMetadata(igdbId);
                    if (metadata) {
                        Object.assign(gameData, metadata);
                    }
                }

                await addGame(gameData);
                addedCount++;
            } else {
                // Update existing game with potential new playtime aggregation and IDs
                await addGame({
                    ...existingGame,
                    legacy_playtime_seconds: legacyEntries,
                    xbox_store_id: game.xboxStoreId,
                    xbox_market_id: game.xboxMarketId
                });
            }

            // 5. Achievement Sync
            if (activeGameId && game.legacyId) {
                try {
                    await new Promise(r => setTimeout(r, 800));
                    const localAchievements = await getGameAchievements(activeGameId);
                    const xboxAchievements = await xboxClient.fetchAchievements(
                        authData.xstsToken, 
                        authData.userHash, 
                        account.external_id, 
                        game.legacyId
                    );
                    
                    if (xboxAchievements.length > 0) {
                        if (localAchievements && localAchievements.length > 0) {
                            const unlockedXbox = xboxAchievements.filter(a => a.unlocked);
                            for (const xbAch of unlockedXbox) {
                                const match = localAchievements.find(la => 
                                    la.name.toLowerCase() === xbAch.name.toLowerCase()
                                );
                                if (match && !match.unlocked) {
                                    await updateAchievementStatusByName(activeGameId, match.name, xbAch.unlockedAt);
                                }
                            }
                        } else {
                            const definitions = xboxAchievements.map(a => ({
                                id: a.id,
                                name: a.name,
                                description: a.description,
                                iconUrl: a.iconUrl,
                                isHidden: a.isHidden
                            }));
                            const earnedStatus = xboxAchievements
                                .filter(a => a.unlocked)
                                .map(a => ({
                                    id: a.id,
                                    earned: true,
                                    earnedDateTime: a.unlockedAt
                                }));
                            await savePsnAchievements(activeGameId, definitions, earnedStatus);
                        }
                    }
                } catch (e) {
                    console.warn(`[XboxSync] Failed to sync achievements for ${game.name}:`, e.message);
                }
            }

            await new Promise(r => setTimeout(r, 400));
        }

        return { success: true, added: addedCount, playtimeMinutes: totalPlaytimeSeconds / 60 };

    } catch (error) {
        console.error('[XboxSync] Fatal Error:', error);
        return { success: false, error: error.message };
    }
}
