
import { BrowserWindow } from 'electron';
import xboxAuth from './XboxAuthService.js';
import xboxClient from './XboxClient.js';
import { addGame, getLibrary, getGameById } from '../../db/modules/games.js';
import { fetchIGDBMetadata, fetchIGDBGameByExternalUid, searchIGDB } from '../../lib/igdb.js';
import { saveLinkedAccount, getLinkedAccounts } from '../../db/modules/settings.js';
import { savePsnAchievements, getGameAchievements, updateAchievementStatusByName } from '../../db/modules/achievements.js';

const PLATFORM_MAP = {
    'xbox_360': 12,
    'xbox_one': 49,
    'xbox_series': 169,
    'xbox_app_pc': 99004
};

export async function linkXboxAccount(sender) {
    const window = BrowserWindow.fromWebContents(sender);
    try {
        const auth = await xboxAuth.login(window);
        await saveLinkedAccount({
            platform: 'xbox',
            external_id: auth.xid,
            username: auth.gamertag,
            avatar_url: auth.avatarUrl,
            auth_data: JSON.stringify({
                xstsToken: auth.xstsToken,
                userHash: auth.userHash,
                expiry: Date.now() + (1000 * 60 * 60 * 4)
            }),
            created_at: Date.now()
        });
        return { success: true, username: auth.gamertag };
    } catch (error) {
        console.error('[XboxLink] Failed:', error);
        return { success: false, error: error.message };
    }
}

export async function syncXboxLibrary(sender) {
    sender.send('steam:sync-progress', { message: 'Initializing Xbox Sync...', current: 0, total: 0 });
    try {
        const accounts = await getLinkedAccounts('xbox');
        const account = accounts[0]; 
        if (!account) return { success: false, error: "No Xbox account linked. Please connect first." };
        const authData = JSON.parse(account.auth_data);
        if (authData.expiry && Date.now() > authData.expiry) return { success: false, error: "Xbox session expired. Please re-connect." };
        sender.send('steam:sync-progress', { message: `Fetching games for ${account.username}...`, current: 0, total: 0 });
        const xboxGames = await xboxClient.fetchLibrary(authData.xstsToken, authData.userHash, account.external_id);
        if (!xboxGames || xboxGames.length === 0) return { success: true, added: 0, message: 'No valid Xbox games found.' };
        const totalGames = xboxGames.length;
        sender.send('steam:sync-progress', { message: `Found ${totalGames} valid titles. Importing...`, current: 0, total: totalGames });

        let addedCount = 0;
        let totalSyncedCount = 0;
        let totalPlaytimeSeconds = 0;

        for (let i = 0; i < totalGames; i++) {
            const game = xboxGames[i];
            sender.send('steam:sync-progress', { message: `Processing: ${game.name}`, current: i + 1, total: totalGames });

            let igdbId = null;
            if (game.xboxStoreId) {
                try { igdbId = await fetchIGDBGameByExternalUid([11, 54], game.xboxStoreId); } catch (e) {}
            }
            if (!igdbId && game.xboxMarketId) {
                try { igdbId = await fetchIGDBGameByExternalUid(31, game.xboxMarketId); } catch (e) {}
            }
            if (!igdbId) {
                const searchResults = await searchIGDB(game.name);
                if (searchResults && searchResults.length > 0) igdbId = searchResults[0].id;
            }

            const resolvedId = igdbId ? String(igdbId) : `xbox-${game.xboxMarketId || game.legacyId || Date.now()}`;
            const existingGame = await getGameById(resolvedId);

            let legacyEntries = [];
            const xboxSeconds = game.playtimeSeconds || 0;
            totalPlaytimeSeconds += xboxSeconds;

            if (existingGame) {
              legacyEntries = existingGame.legacy_playtime_seconds || [];
              const hasXboxSource = legacyEntries.some(e => e.source?.toLowerCase().trim() === 'xbox');
              if (!hasXboxSource && xboxSeconds > 0) {
                legacyEntries.push({ source: 'Xbox', platform_id: 99004, seconds: xboxSeconds });
              }
            } else {
              legacyEntries = xboxSeconds > 0 ? [{ source: 'Xbox', platform_id: 99004, seconds: xboxSeconds }] : [];
            }

            let platformOwnership = [];
            if (game.platforms && Array.isArray(game.platforms)) {
                platformOwnership = game.platforms.map(pTag => PLATFORM_MAP[pTag]).filter(id => id !== undefined).map((id) => ({ id: id, price: 0 }));
            }
            if (platformOwnership.length === 0) platformOwnership.push({ id: 49, price: 0 }); 

            let activeGameId = resolvedId;
            if (!existingGame) {
                const gameData = {
                    id: resolvedId,
                    name: game.name,
                    status: 'Backlog',
                    xbox_store_id: game.xboxStoreId,
                    xbox_market_id: game.xboxMarketId,
                    legacy_playtime_seconds: legacyEntries,
                    platform_ownership: platformOwnership,
                    skip_achievement_scan: true
                };
                if (igdbId) {
                    const metadata = await fetchIGDBMetadata(igdbId);
                    if (metadata) Object.assign(gameData, metadata);
                }
                await addGame(gameData);
                addedCount++;
            } else {
                await addGame({
                    ...existingGame,
                    legacy_playtime_seconds: legacyEntries,
                    xbox_store_id: game.xboxStoreId,
                    xbox_market_id: game.xboxMarketId,
                    skip_achievement_scan: true
                });
            }

            if (activeGameId && game.legacyId) {
                try {
                    await new Promise(r => setTimeout(r, 800));
                    const localAchievements = await getGameAchievements(activeGameId);
                    const xboxAchievements = await xboxClient.fetchAchievements(authData.xstsToken, authData.userHash, account.external_id, game.legacyId);
                    if (xboxAchievements.length > 0) {
                        if (localAchievements && localAchievements.length > 0) {
                            const unlockedXbox = xboxAchievements.filter(a => a.unlocked);
                            for (const xbAch of unlockedXbox) {
                                const match = localAchievements.find(la => la.name.toLowerCase() === xbAch.name.toLowerCase());
                                if (match && !match.unlocked) {
                                    await updateAchievementStatusByName(activeGameId, match.name, xbAch.unlockedAt);
                                    totalSyncedCount++;
                                }
                            }
                        } else {
                            const definitions = xboxAchievements.map(a => ({ id: a.id, name: a.name, description: a.description, iconUrl: a.iconUrl, isHidden: a.isHidden }));
                            const earnedStatus = xboxAchievements.filter(a => a.unlocked).map(a => ({ id: a.id, earned: true, earnedDateTime: a.unlockedAt }));
                            await savePsnAchievements(activeGameId, definitions, earnedStatus);
                            totalSyncedCount += earnedStatus.length;
                        }
                    }
                } catch (e) { console.warn(`[XboxSync] Failed to sync achievements for ${game.name}:`, e.message); }
            }
            await new Promise(r => setTimeout(r, 400));
        }

        // 6. BATCH SOCIAL SIGNAL
        sender.send('SOCIAL_BROADCAST_SYNC', { platform: 'Xbox', added: addedCount, achievements: totalSyncedCount });

        return { success: true, added: addedCount, playtimeMinutes: totalPlaytimeSeconds / 60 };
    } catch (error) {
        console.error('[XboxSync] Fatal Error:', error);
        return { success: false, error: error.message };
    }
}
