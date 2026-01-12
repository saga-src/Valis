
import electron from 'electron';
const { BrowserWindow, session } = electron;
import { getSetting, saveSetting, saveLinkedAccount, getLinkedAccounts } from '../db/modules/settings.js';
import { fetchSteamProfile } from './integrations/SteamScraper.js';

export class AuthService {
  async loginToSteam() {
    console.log('🔍 Opening Auth Window (Steam)...');
    return new Promise((resolve, reject) => {
      try {
        const authWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: true,
          title: 'Login to Steam',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:valis_steam'
          }
        });

        const steamUrl = 'https://steamcommunity.com/login/home/?goto=';
        console.log('🔗 Loading URL:', steamUrl);
        authWindow.loadURL(steamUrl);

        // Use the specific session for this partition
        const authSession = session.fromPartition('persist:valis_steam');
        let isResolved = false;

        // 1. Helper to Process Cookie
        const checkAndSaveCookie = async (specificCookie = null) => {
          if (isResolved) return false;

          try {
            let cookie = specificCookie;
            
            // If not provided from event, fetch from store
            if (!cookie) {
              const cookies = await authSession.cookies.get({ name: 'steamLoginSecure' });
              if (cookies.length > 0) cookie = cookies[0];
            }

            if (cookie && cookie.name === 'steamLoginSecure') {
              const cookieValue = cookie.value;
              // Extract Steam ID from cookie (format: steamid%7Ctoken or steamid|token)
              const decoded = decodeURIComponent(cookieValue);
              const steamId = decoded.split('|')[0] || decoded.split('%7C')[0];
              
              if (steamId && /^\d+$/.test(steamId)) {
                  // Check if account is already linked
                  const existingAccounts = await getLinkedAccounts('steam');
                  const isDuplicate = existingAccounts.some(acc => acc.external_id === steamId);

                  if (isDuplicate) {
                      console.log(`[Auth] Account ${steamId} already linked. Logging out...`);
                      // Clear session to force user to login with a different account
                      await authSession.clearStorageData();
                      authWindow.loadURL(steamUrl);
                      return false;
                  }

                  // Save formatted string for header use
                  const cookieString = `${cookie.name}=${cookie.value}`;
                  
                  // Fetch API Key for profile lookup
                  const apiKey = await getSetting('steam_api_key');
                  let profileData = { username: 'Steam User', avatar: '' };
                  
                  if (apiKey) {
                      const profile = await fetchSteamProfile(steamId, apiKey);
                      if (profile) profileData = profile;
                  }

                  // Save to linked_accounts
                  await saveLinkedAccount({
                      platform: 'steam',
                      external_id: steamId,
                      username: profileData.username,
                      avatar_url: profileData.avatar,
                      auth_data: cookieString,
                      created_at: Date.now()
                  });
                  
                  // Legacy compatibility (optional, can be removed later)
                  await saveSetting('steam_user_id', steamId);
                  await saveSetting('steam_cookie', cookieString);
                  
                  isResolved = true;
                  
                  // Cleanup
                  authSession.cookies.removeListener('changed', cookieListener);
                  authWindow.close();
                  resolve({ success: true, steamId });
                  return true;
              }
            }
          } catch (error) {
            console.error('[Auth] Cookie check failed:', error);
          }
          return false;
        };

        // 2. Listen for new login (Manual login)
        const cookieListener = (event, cookie, cause, removed) => {
          if (cookie.name === 'steamLoginSecure' && !removed) {
            checkAndSaveCookie(cookie);
          }
        };
        
        authSession.cookies.on('changed', cookieListener);

        // 3. Check immediately on navigation finish (Auto-login detection)
        authWindow.webContents.on('did-finish-load', async () => {
          const found = await checkAndSaveCookie();
          if (found) console.log('[Auth] Detected existing session.');
        });

        // Cleanup
        authWindow.on('closed', () => {
          authSession.cookies.removeListener('changed', cookieListener);
          if (!isResolved) {
              resolve({ success: false, message: 'Window closed by user' });
          }
        });
      } catch (err) {
        console.error('❌ Error creating Steam Auth window:', err);
        reject(err);
      }
    });
  }

  async getSteamCookie() {
    return await getSetting('steam_cookie');
  }
  
  async getSteamId() {
    return await getSetting('steam_user_id');
  }
}

export const authService = new AuthService();
