
import { session } from 'electron';
import { eraseLibraryData, eraseSettingsData, eraseAccountData } from '../db/modules/reset.js';

class FactoryResetService {
    
    async performReset(options) {
        console.log('[FactoryReset] Starting reset with options:', options);
        // Default to full reset if no options provided
        const { library, settings, accounts } = options || { library: true, settings: true, accounts: true };
        const results = [];

        try {
            // 1. Erase Library (Games, Achievements, Playtime)
            if (library) {
                await eraseLibraryData();
                results.push('Library erased');
            }

            // 2. Erase Settings (Theme, Preferences, Paths)
            if (settings) {
                await eraseSettingsData();
                results.push('Settings reset');
            }

            // 3. Unlink Accounts (DB Tokens + Browser Cookies)
            if (accounts) {
                await eraseAccountData();
                
                // CRITICAL: Clear Electron cookies/storage to kill web sessions
                
                // Default Session
                if (session.defaultSession) {
                    await session.defaultSession.clearStorageData();
                }
                
                // Clear specific partitions used by auth services
                const partitions = [
                    'persist:psn_standard_v1',
                    'persist:valis_epic',
                    'persist:valis_steam'
                ];

                for (const part of partitions) {
                    try {
                        const s = session.fromPartition(part);
                        await s.clearStorageData();
                        console.log(`[FactoryReset] Cleared partition: ${part}`);
                    } catch (e) {
                        console.warn(`[FactoryReset] Failed to clear partition ${part}:`, e.message);
                    }
                }
                
                results.push('Accounts unlinked and sessions cleared');
            }

            console.log('[FactoryReset] Complete.', results);
            return { success: true, actions: results };

        } catch (error) {
            console.error('[FactoryReset] Failed:', error);
            throw error;
        }
    }
}

export default new FactoryResetService();
