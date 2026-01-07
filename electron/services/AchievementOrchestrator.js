import { cloudGate } from './CloudGate.js';
import xboxClient from './integrations/XboxClient.js';
import psnClient from './integrations/PsnClient.js';
import psnAuth from './integrations/PsnAuthService.js';
import { getLinkedAccounts, saveLinkedAccount } from '../db/modules/settings.js';

/**
 * AchievementOrchestrator (Debug Version)
 * 
 * Routes achievement refresh requests to the correct platform provider.
 * Includes heavy logging to track routing decisions for platform exclusives.
 */
class AchievementOrchestrator {
  /**
   * Fetches achievement status and definitions for a game from its native source.
   * @param {Object} game Raw DB Game object
   * @returns {Promise<Array>} List of standard achievements: { id, name, description, icon, is_hidden, unlocked, unlocked_at }
   */
  async fetchAchievements(game) {
    if (!game) return [];

    console.log('[Orchestrator] deciding strategy for:', game.name, 'IDs:', { 
        steam: game.steam_id, 
        xbox: game.xbox_market_id || game.xbox_store_id, 
        psn_trophy: game.psn_trophy_id,
        psn_store: game.psn_id
    });

    // --- STRATEGY 1: STEAM (CloudGate Proxy) ---
    if (game.steam_id && game.steam_id !== 'undefined' && game.steam_id !== '') {
        console.log(`[Orchestrator] -> Routing to Steam CloudGate (AppID: ${game.steam_id})`);
        
        try {
            // 1. Fetch Definitions (Schema) via Proxy - No User Account Required
            // This ensures we get real names ("First Blood") and Icons, not just internal IDs.
            const schema = await cloudGate.fetchSteamSchema(game.steam_id);
            
            if (!schema || schema.length === 0) {
                console.warn('[Orchestrator] Steam Schema empty. Game might not have achievements.');
                return [];
            }
            console.log(`[Orchestrator] -> Got ${schema.length} definitions from Cloud.`);

            // 2. Fetch Progress (Only if Account Linked)
            const accounts = await getLinkedAccounts('steam');
            const steamUserId = accounts[0]?.external_id;
            let unlockedMap = new Map(); // Map<InternalID, { achieved, unlocktime }>

            if (steamUserId) {
                console.log(`[Orchestrator] -> Fetching progress for User ${steamUserId}...`);
                const progressData = await cloudGate.fetchSteamAchievements(steamUserId, game.steam_id);
                
                // Map progress by 'apiname' (Internal ID)
                if (progressData?.playerstats?.achievements) {
                    progressData.playerstats.achievements.forEach(a => {
                        unlockedMap.set(a.apiname, { 
                            achieved: a.achieved, 
                            unlocktime: a.unlocktime 
                        });
                    });
                }
            } else {
                console.log('[Orchestrator] ℹ️ No Steam account linked. Fetching definitions only (all locked).');
            }

            // 3. Merge Schema + Progress
            // We drive the loop using Schema (the source of truth for names/icons)
            return schema.map(def => {
                const status = unlockedMap.get(def.name); // Schema 'name' == Internal ID
                return {
                    id: def.name,               // Internal ID (e.g. NEW_ACHIEVEMENT_1_0)
                    name: def.displayName,      // Real Name (e.g. "Master")
                    description: def.description || '',
                    icon: def.icon,             // Real URL
                    is_hidden: def.hidden === 1,
                    unlocked: status ? status.achieved === 1 : false,
                    unlocked_at: (status && status.unlocktime) ? new Date(status.unlocktime * 1000).toISOString() : null
                };
            });

        } catch (e) {
            console.error(`[Orchestrator] Steam Cloud fetch failed: ${e.message}`);
        }
        return [];
    }

    // --- STRATEGY 2: XBOX ---
    if (game.xbox_market_id || game.xbox_store_id) {
      console.log('[Orchestrator] -> Detected Xbox Game. Fetching credentials...');
      try {
        const accounts = await getLinkedAccounts('xbox');
        if (!accounts || accounts.length === 0) {
            console.warn('[Orchestrator] ❌ Xbox detected but NO LINKED ACCOUNT found.');
            return [];
        }
        
        const account = accounts[0];
        const authData = JSON.parse(account.auth_data);

        // Check basic expiry
        if (authData.expiry && Date.now() > authData.expiry) {
          console.warn('[Orchestrator] Xbox token expired. Re-auth required via Settings.');
          return [];
        }

        const targetId = game.legacy_id || game.xbox_market_id || game.xbox_store_id;
        console.log('[Orchestrator] -> Calling XboxClient for ID:', targetId);
        
        const results = await xboxClient.fetchAchievements(
          authData.xstsToken, 
          authData.userHash, 
          account.external_id, 
          targetId
        );

        console.log('[Orchestrator] -> Xbox Client returned:', results.length, 'achievements');
        return results.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.iconUrl,
          is_hidden: a.isHidden,
          unlocked: a.unlocked,
          unlocked_at: a.unlockedAt
        }));
      } catch (e) {
        console.error(`[Orchestrator] Xbox fetch failed: ${e.message}`);
      }
      return [];
    }

    // --- STRATEGY 3: PSN ---
    if (game.psn_trophy_id || (game.psn_id && game.psn_id !== 'null')) {
      console.log('[Orchestrator] -> Detected PSN Game candidate. Fetching credentials...');
      try {
        const accounts = await getLinkedAccounts('psn');
        if (!accounts || accounts.length === 0) {
            console.warn('[Orchestrator] ❌ PSN detected but NO LINKED ACCOUNT found.');
            return [];
        }

        let account = accounts[0];
        let authData = JSON.parse(account.auth_data);
        
        // Token Refresh Logic
        const now = Date.now() / 1000;
        if (authData.expiresIn && now > (authData.obtainedAt + authData.expiresIn - 300)) {
          console.log('[Orchestrator] 🔄 PSN Token expired. Refreshing...');
          const newTokens = await psnAuth.refresh(authData.refreshToken);
          authData = { ...newTokens, obtainedAt: Date.now() / 1000 };
          
          account = { ...account, auth_data: JSON.stringify(authData) };
          await saveLinkedAccount(account);
        }

        // Just-In-Time Resolution
        if (!game.psn_trophy_id) {
            console.log(`[Orchestrator] 🔍 Searching user's PSN history for: ${game.name}`);
            const match = await psnClient.findTrophyTitle({ accessToken: authData.accessToken }, game.name);
            
            if (match) {
                console.log(`[Orchestrator] ✅ Found Match: ${match.trophyTitleName} (${match.npCommunicationId})`);
                game.psn_trophy_id = match.npCommunicationId;
                game.npServiceName = match.npServiceName; 
                
                // Persist to DB immediately so we don't search again next time
                const { db } = await import('../db/client.js'); 
                await db.updateTable('games')
                    .set({ psn_trophy_id: match.npCommunicationId })
                    .where('id', '=', game.id)
                    .execute();
            } else {
                console.log(`[Orchestrator] ❌ Game not found in user's recent trophy list.`);
                // If we still don't have an ID, we can't scrape achievements.
                return [];
            }
        }

        console.log('[Orchestrator] -> Fetching PSN Definitions & Progress...');
        
        // 1. Fetch BOTH Definitions (Names) and Earned Status (Progress)
        // We default serviceName to 'trophy' if missing
        const serviceName = game.npServiceName || 'trophy';
        
        const [definitions, earnedData] = await Promise.all([
            psnClient.fetchTrophyDefinitions({ accessToken: authData.accessToken }, game.psn_trophy_id, serviceName),
            psnClient.fetchEarnedTrophies({ accessToken: authData.accessToken }, game.psn_trophy_id, serviceName)
        ]);

        console.log(`[Orchestrator] -> Got ${definitions.length} definitions and ${earnedData.length} status records.`);

        // 2. Merge them into the format expected by saveAchievementsToDb
        const merged = definitions.map(def => {
            const status = earnedData.find(e => e.id === def.id);
            return {
                id: def.id,
                name: def.name,
                description: def.description,
                icon: def.iconUrl,       // Generic saver maps 'icon' -> 'icon_url'
                is_hidden: def.isHidden,
                unlocked: status ? status.earned : false,
                unlocked_at: status ? status.earnedDateTime : null
            };
        });

        console.log('[Orchestrator] -> Merging complete. Returning', merged.length, 'trophies.');
        return merged;

      } catch (e) {
        console.error(`[Orchestrator] PSN fetch failed: ${e.message}`);
      }
      return [];
    }

    console.log('[Orchestrator] ⚠️ No valid ID matched for achievement fetch.');
    return [];
  }
}

export default new AchievementOrchestrator();