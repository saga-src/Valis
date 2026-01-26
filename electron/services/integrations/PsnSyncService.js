
import psnAuthService from './PsnAuthService.js';
import psnClient from './PsnClient.js';
import { db } from '../../db/client.js'; 
import { addGame, getLibrary, getGameById } from '../../db/modules/games.js';
import { savePsnAchievements, getGameAchievements, unlockAchievement } from '../../db/modules/achievements.js';
import { getLinkedAccounts, saveLinkedAccount } from '../../db/modules/settings.js';
import { searchIGDB, fetchIGDBMetadata, fetchGameByPsnId, fetchGameByPsnStoreId } from '../../lib/igdb.js';

const PLATFORM_MAP = { 'PS5': 167, 'PS4': 48, 'PS3': 9, 'PSVita': 46, 'PSP': 38 };

const getPlatformKey = (rawPlatform) => {
    if (!rawPlatform) return 'Playstation';
    const p = rawPlatform.toUpperCase();
    if (p.includes('PS5') || p.includes('PLAYSTATION 5')) return 'Playstation 5';
    if (p.includes('PS4') || p.includes('PLAYSTATION 4')) return 'Playstation 4';
    if (p.includes('PS3') || p.includes('PLAYSTATION 3')) return 'Playstation 3';
    if (p.includes('VITA')) return 'Playstation Vita';
    if (p.includes('PSP')) return 'Playstation Portable';
    return 'Playstation'; 
};

function parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

export async function syncPsnLibrary(sender) {
    sender.send('steam:sync-progress', { message: 'Connecting to PlayStation Network...', current: 0, total: 0 });

    const accounts = await getLinkedAccounts('psn');
    let account = accounts[0];
    if (!account) return { success: false, error: 'No PSN account linked.' };
    let authData = JSON.parse(account.auth_data);
    const now = Date.now() / 1000;
    if (authData.expiresIn && now > (authData.obtainedAt + authData.expiresIn - 300)) {
        try {
            const newTokens = await psnAuthService.refresh(authData.refreshToken);
            authData = { ...newTokens, obtainedAt: Date.now() / 1000 };
            const updatedAccount = { ...account, auth_data: JSON.stringify(authData) };
            await saveLinkedAccount(updatedAccount);
            account = updatedAccount;
        } catch (e) { return { success: false, error: 'Token expired.' }; }
    }
    const authorization = { accessToken: authData.accessToken };

    try {
        const profile = await psnClient.getProfile(authorization);
        if (profile.onlineId !== 'PlayStation User') {
             const combinedAvatar = [profile.avatarUrl, profile.profilePicUrl].filter(Boolean).join(';;;');
             await saveLinkedAccount({
                ...account,
                username: profile.onlineId,
                external_id: profile.onlineId,
                avatar_url: combinedAvatar
            });
        }
    } catch (e) {}

    let psnGames = [];
    try { psnGames = await psnClient.fetchLibrary(authorization); } 
    catch (e) { return { success: false, error: 'Library fetch failed.' }; }

    const totalGames = psnGames.length;
    sender.send('steam:sync-progress', { message: `Processing ${totalGames} games...`, current: 0, total: totalGames });

    let totalAdded = 0;
    let totalSynced = 0;
    let totalPlaytimeSeconds = 0;

    for (let i = 0; i < totalGames; i++) {
        const game = psnGames[i];
        const cleanTitle = game.cleanName || game.titleName;
        const cleanStoreId = game.conceptId ? String(game.conceptId).split('.')[0] : null;
        const platformLabel = getPlatformKey(game.platform);
        
        sender.send('steam:sync-progress', { 
            message: `Processing: ${cleanTitle} (${platformLabel})`, 
            current: i + 1, 
            total: totalGames 
        });

        let igdbId = null;
        if (cleanStoreId) {
            try { igdbId = await fetchGameByPsnStoreId(cleanStoreId); } catch(e) {}
        }
        if (!igdbId) {
            try { igdbId = await fetchGameByPsnId(game.npCommunicationId); } catch(e) {}
        }
        if (!igdbId) {
            const searchResults = await searchIGDB(cleanTitle);
            if (searchResults && searchResults.length > 0) igdbId = searchResults[0].id;
        }

        const primaryPsnId = cleanStoreId || game.npCommunicationId;
        const resolvedId = igdbId ? String(igdbId) : `psn-${primaryPsnId}`;
        const existingGame = await getGameById(resolvedId);

        let legacyEntries = [];
        const psnSeconds = parseDuration(game.playDuration);
        const specificSource = platformLabel;
        totalPlaytimeSeconds += psnSeconds;

        if (existingGame) {
          legacyEntries = existingGame.legacy_playtime_seconds || [];
          const hasSpecificSource = legacyEntries.some(e => e.source?.toLowerCase().trim() === specificSource.toLowerCase().trim());
          if (!hasSpecificSource && psnSeconds > 0) {
            legacyEntries.push({ source: specificSource, platform_id: PLATFORM_MAP[game.platform] || 48, seconds: psnSeconds });
          }
        } else {
          legacyEntries = psnSeconds > 0 ? [{ source: specificSource, platform_id: PLATFORM_MAP[game.platform] || 48, seconds: psnSeconds }] : [];
        }

        let activeGameId = resolvedId;
        if (!existingGame) {
            const gameData = {
                id: resolvedId,
                name: cleanTitle,
                psn_id: cleanStoreId,
                psn_trophy_id: game.npCommunicationId,
                platform_ownership: [{ id: PLATFORM_MAP[game.platform] || 48, price: 0 }],
                legacy_playtime_seconds: legacyEntries,
                status: 'Backlog',
                skip_achievement_scan: true
            };
            if (igdbId) {
                const metadata = await fetchIGDBMetadata(igdbId);
                if (metadata) Object.assign(gameData, metadata);
            }
            await addGame(gameData);
            totalAdded++;
        } else {
            await addGame({
              ...existingGame,
              legacy_playtime_seconds: legacyEntries,
              psn_id: cleanStoreId,
              psn_trophy_id: game.npCommunicationId,
              skip_achievement_scan: true
            });
        }

        if (activeGameId && game.npCommunicationId) {
            try {
                const serviceName = game.npServiceName || 'trophy';
                const psnEarned = await psnClient.fetchEarnedTrophies(authorization, game.npCommunicationId, serviceName);
                const localAchievements = await getGameAchievements(activeGameId) || [];

                if (localAchievements.length === 0 && psnEarned.length > 0) {
                    const psnDefs = await psnClient.fetchTrophyDefinitions(authorization, game.npCommunicationId, serviceName);
                    const converted = psnDefs.map(def => ({
                        id: def.id,
                        name: def.name,
                        displayName: def.name,
                        description: def.description,
                        iconUrl: def.iconUrl,
                        isHidden: def.isHidden ? 1 : 0,
                        percentage: 0
                    }));
                    await savePsnAchievements(activeGameId, converted, psnEarned);
                    totalSynced++;
                } else if (localAchievements.length > 0) {
                    const psnDefs = await psnClient.fetchTrophyDefinitions(authorization, game.npCommunicationId, serviceName);
                    let unlockCount = 0;
                    for (const earnedTrophy of psnEarned) {
                        if (earnedTrophy.earned) {
                            const def = psnDefs.find(d => d.id === earnedTrophy.id);
                            if (!def) continue;
                            const match = localAchievements.find(a => (a.displayName || '').toLowerCase() === def.name.toLowerCase() || (a.name || '').toLowerCase() === def.name.toLowerCase());
                            if (match && !match.unlockedAt) {
                                await unlockAchievement(activeGameId, match.name, earnedTrophy.earnedDateTime);
                                unlockCount++;
                            }
                        }
                    }
                    if (unlockCount > 0) totalSynced++;
                }
            } catch (e) { console.warn(`[PsnSync] Trophy Error for ${cleanTitle}: ${e.message}`); }
        }
        await new Promise(r => setTimeout(r, 600));
    }

    // 6. BATCH SOCIAL SIGNAL
    sender.send('SOCIAL_BROADCAST_SYNC', { platform: 'PlayStation', added: totalAdded, achievements: totalSynced });

    return { success: true, added: totalAdded, synced: totalSynced, playtimeMinutes: totalPlaytimeSeconds / 60 };
}
