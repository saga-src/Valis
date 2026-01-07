import { ipcMain, shell, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import { db } from '../db/client.js';
import * as dbQueries from '../db/queries.js';
import { getLinkedAccounts, removeLinkedAccount, saveLinkedAccount } from '../db/modules/settings.js';
import axios from 'axios';
import { authService } from '../services/AuthService.js';
import epicAuth from '../services/integrations/EpicAuthService.js';
import psnAuthService from '../services/integrations/PsnAuthService.js';
import psnClient from '../services/integrations/PsnClient.js';
import { syncSteamLibrary } from '../services/integrations/SteamSyncService.js';
import { syncEpicLibrary } from '../services/integrations/EpicSyncService.js';
import { syncPsnLibrary } from '../services/integrations/PsnSyncService.js';
import { syncXboxLibrary, linkXboxAccount } from '../services/integrations/XboxSyncService.js';

// Helper to expand Windows environment variables like %APPDATA%
function expandPath(pathStr) {
  if (!pathStr) return '';
  return pathStr.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
}

export function registerSettingsHandlers() {
    // Utility: Open URL in System Browser
    ipcMain.handle('app:open-external', async (_, url) => {
        await shell.openExternal(url);
        return { success: true };
    });

    // Steam API Key Page (Shared Session)
    ipcMain.handle('open-steam-apikey-page', async () => {
        const win = new BrowserWindow({
            width: 900,
            height: 700,
            show: true,
            title: 'Steam Web API Key',
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: 'persist:valis_steam' // Shares session with Steam Auth
            }
        });
        win.loadURL('https://steamcommunity.com/dev/apikey');
        return { success: true };
    });

    // Watch Paths Handlers
    ipcMain.handle('settings:get-watch-paths', async () => {
        return await db.selectFrom('watch_paths').selectAll().execute();
    });

    ipcMain.handle('settings:add-watch-path', async (_, { path, type }) => {
        if (!path || !type) throw new Error('Path and type are required');
        const result = await db.insertInto('watch_paths')
            .values({ path, type, recursive: 1 })
            .returningAll()
            .executeTakeFirst();
        return result;
    });

    ipcMain.handle('settings:remove-watch-path', async (_, id) => {
        await db.deleteFrom('watch_paths').where('id', '=', Number(id)).execute();
        return true;
    });

    ipcMain.handle('settings:check-path-exists', async (_, pathToCheck) => {
        try {
            const expanded = expandPath(pathToCheck);
            await fs.access(expanded);
            return true;
        } catch {
            return false;
        }
    });

    // General Settings (Key-Value)
    ipcMain.handle('settings:get', async (_, key) => {
        return await dbQueries.getSetting(key);
    });

    ipcMain.handle('settings:save', async (_, { key, value }) => {
        await dbQueries.setSetting(key, value);
        return { success: true };
    });

    // Linked Accounts
    ipcMain.handle('settings:get-linked-accounts', async (_, platform) => {
        return await getLinkedAccounts(platform);
    });

    ipcMain.handle('settings:unlink-account', async (_, id) => {
        await removeLinkedAccount(id);
        return { success: true };
    });

    // Verify IGDB Credentials
    ipcMain.handle('settings:test-igdb', async (_, { clientId, clientSecret }) => {
        try {
            if (!clientId || !clientSecret) throw new Error('Missing credentials');

            await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials'
                }
            });
            
            return { success: true };
        } catch (error) {
            console.error('[Settings] IGDB Test Failed:', error.response?.data || error.message);
            const msg = error.response?.data?.message || error.message;
            return { success: false, error: msg };
        }
    });

    // Steam Authentication
    ipcMain.handle('auth:steam', async () => {
        return await authService.loginToSteam();
    });

    ipcMain.handle('auth:get-steam-user', async () => {
        const id = await authService.getSteamId();
        return { steamId: id };
    });

    // Epic Authentication
    ipcMain.handle('auth:epic', async () => {
        return await epicAuth.loginToEpic();
    });

    // Xbox Authentication (Link Only)
    ipcMain.handle('auth:xbox', async (event) => {
        return await linkXboxAccount(event.sender);
    });

    // PSN Authentication
    ipcMain.handle('auth:psn', async (_, npsso) => {
        try {
            // 1. Get NPSSO (Manual or Auto)
            let token = npsso;
            if (!token) {
                token = await psnAuthService.getNpsso();
            }

            if (!token) throw new Error("No NPSSO token found.");

            // 2. Perform Exchange
            const tokens = await psnAuthService.authenticate(token);
            
            // 3. Fetch Real Profile (Identity)
            let profile = null;
            try {
                // Pass the FULL tokens object (contains accessToken AND idToken)
                profile = await psnClient.getProfile(tokens); 
                console.log('[IPC] ✅ Profile fetched:', profile ? profile.onlineId : 'Failed');
            } catch (err) {
                console.warn('[IPC] Could not fetch profile during auth:', err);
            }

            // 4. Save to DB
            const username = profile ? profile.onlineId : 'PlayStation User';
            const externalId = profile ? profile.onlineId : `psn-${Date.now()}`; // Fallback ID to prevent "me" duplicates
            
            // Combine URLs if both exist
            const images = [profile.avatarUrl, profile.profilePicUrl].filter(Boolean);
            const combinedAvatar = images.join(';;;');

            await saveLinkedAccount({
                platform: 'psn',
                external_id: externalId, 
                username: username, 
                avatar_url: combinedAvatar,
                auth_data: JSON.stringify({ ...tokens, obtainedAt: Date.now() / 1000 }),
                created_at: Date.now()
            });
            return { success: true };
        } catch (e) {
            console.error('[IPC Main] auth:psn CRASHED:', e);
            if (e.message === 'USER_CLOSED_WINDOW') {
                return { success: false, message: 'Login cancelled' };
            }
            return { success: false, message: e.message };
        }
    });

    // Steam Sync
    ipcMain.handle('settings:sync-steam', async (event) => {
        try {
            const result = await syncSteamLibrary(event.sender);
            return { success: true, ...result };
        } catch (e) {
            console.error('Steam Sync Error:', e);
            return { success: false, error: e.message };
        }
    });

    // Epic Sync
    ipcMain.handle('settings:sync-epic', async (event) => {
        try {
            const result = await syncEpicLibrary(event.sender);
            return { success: true, ...result };
        } catch (e) {
            console.error('Epic Sync Error:', e);
            return { success: false, error: e.message };
        }
    });

    // PSN Sync
    ipcMain.handle('settings:sync-psn', async (event) => {
        try {
            const result = await syncPsnLibrary(event.sender);
            return { success: true, ...result };
        } catch (e) {
            console.error('PSN Sync Error:', e);
            return { success: false, error: e.message };
        }
    });

    // Xbox Sync
    ipcMain.handle('settings:sync-xbox', async (event) => {
        try {
            const result = await syncXboxLibrary(event.sender);
            return { success: true, ...result };
        } catch (e) {
            console.error('Xbox Sync Error:', e);
            return { success: false, error: e.message };
        }
    });
}
