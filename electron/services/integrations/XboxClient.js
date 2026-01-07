
import axios from 'axios';

class XboxClient {
    
    /**
     * Fetches the user's game history with device detection
     */
    async fetchLibrary(xstsToken, userHash, xid) {
        console.log(`[XboxClient] Fetching library for XID: ${xid}`);
        
        const authHeader = `XBL3.0 x=${userHash};${xstsToken}`;
        
        // Simplified URL: Only ask for details (images/IDs) and basic stats (playtime)
        const url = `https://titlehub.xboxlive.com/users/xuid(${xid})/titles/titlehistory/decoration/detail,stats?maxItems=200`;
        
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': authHeader,
                    'x-xbl-contract-version': '2',
                    'x-xbl-client-name': 'XboxApp',
                    'x-xbl-client-type': 'UWA',
                    'x-xbl-client-version': '39.39.22001.0',
                    'Accept-Language': 'en-US'
                }
            });

            const data = response.data;
            
            const validTypes = ['Game', 'DGame', 'Xbox360Game', 'LiveApp']; 
            
            // 1. Process Raw Data
            const processedGames = (data.titles || [])
                .filter(t => validTypes.includes(t.type) || t.titleType === 'LiveApp' || t.titleType === 'Title')
                .map(t => {
                    // 1. Precise Platform Detection
                    const supportedPlatforms = [];
                    const rawDevices = t.devices || [];

                    // Console Generations
                    if (rawDevices.includes('Xbox360') || t.type === 'Xbox360Game') supportedPlatforms.push('xbox_360');
                    if (rawDevices.includes('XboxOne')) supportedPlatforms.push('xbox_one');
                    if (rawDevices.includes('XboxSeries')) supportedPlatforms.push('xbox_series');
                    
                    // PC (Xbox App)
                    if (rawDevices.includes('PC') || rawDevices.includes('Win32')) supportedPlatforms.push('xbox_app_pc');

                    // Fallback if devices array is empty (common for older titles)
                    if (supportedPlatforms.length === 0) {
                        if (t.type === 'DGame') supportedPlatforms.push('xbox_one'); // Default assumption
                    }

                    // 2. ID Extraction Strategy
                    const deepStoreId = t.detail?.availabilities?.[0]?.ProductId;

                    // 3. Simple Playtime Parsing (Best Effort)
                    let minutes = 0;
                    if (t.stats) {
                        minutes = t.stats.minutesPlayed || t.stats.MinutesPlayed || 0;
                    }
                    const playtimeSeconds = minutes * 60;

                    return {
                        name: t.name,
                        xboxMarketId: t.modernTitleId, // Source 31 (UUID)
                        xboxStoreId: deepStoreId || t.productId, // Source 11/54 (9NT...)
                        legacyId: t.titleId,
                        platforms: supportedPlatforms,
                        playtimeSeconds: playtimeSeconds
                    };
                });

            // 2. Strict Filtering
            return processedGames.filter(g => {
                const hasValidId = !!g.xboxStoreId || !!g.xboxMarketId;
                if (!hasValidId) {
                    console.log(`[XboxClient] 🗑️ Skipping non-Microsoft app: ${g.name} (No valid Store/Xbox ID)`);
                }
                return hasValidId;
            });

        } catch (error) {
            console.error('[XboxClient] API Error:', error.response?.status, error.message);
            throw new Error(`Xbox API Error: ${error.response?.status || error.message}`);
        }
    }

    async fetchAchievements(xstsToken, userHash, xid, titleId) {
        if (!titleId) return [];
        
        const url = `https://achievements.xboxlive.com/users/xuid(${xid})/achievements?titleId=${titleId}&maxItems=1000`;
        const authHeader = `XBL3.0 x=${userHash};${xstsToken}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': authHeader,
                    'x-xbl-contract-version': '2',
                    'Accept-Language': 'en-US'
                }
            });

            const items = response.data.achievements || [];
            
            return items.map(ach => {
                // Xbox returns mediaAssets for icons
                const icon = ach.mediaAssets && ach.mediaAssets.length > 0 ? ach.mediaAssets[0].url : null;
                
                // Fallback chain for description to handle secret achievements
                const finalDescription = ach.description || ach.lockedDescription || 
                    (ach.isSecret ? "This is a secret achievement. Play more to unlock it." : "No description available.");

                return {
                    id: ach.id,
                    name: ach.name,
                    description: finalDescription,
                    iconUrl: icon,
                    unlocked: ach.progressState === 'Achieved',
                    unlockedAt: ach.progression ? ach.progression.timeUnlocked : null, // ISO string
                    isHidden: ach.isSecret
                };
            });

        } catch (error) {
            console.warn(`[XboxClient] Achievement fetch failed for ${titleId}:`, error.message);
            return [];
        }
    }
}

export default new XboxClient();
