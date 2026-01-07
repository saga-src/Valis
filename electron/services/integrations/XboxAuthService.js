
import { BrowserWindow, session } from 'electron';
import axios from 'axios';
import { getLinkedAccounts } from '../../db/modules/settings.js';

// Azure App Configuration (Public Xbox App Client ID)
const CLIENT_ID = '4b838450-0737-4242-a9b2-076bfa19075f'; 
const REDIRECT_URI = 'http://localhost/'; 
const SCOPES = 'XboxLive.Signin offline_access';

class XboxAuthService {
    
    async login(parentWindow) {
        console.log('[XboxAuth] Starting Login Flow...');
        
        return new Promise((resolve, reject) => {
            let isResolved = false; // Flag to track completion
            let loopCount = 0; // Prevent infinite login loops

            const authWindow = new BrowserWindow({
                width: 600, 
                height: 800,
                parent: parentWindow, 
                modal: true, 
                show: true,
                title: 'Login to Xbox Network',
                autoHideMenuBar: true,
                webPreferences: { 
                    nodeIntegration: false, 
                    contextIsolation: true,
                    partition: 'persist:valis_xbox' // Persistent session for cookies
                }
            });

            const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}`;
            
            console.log(`[XboxAuth] Loading: ${authUrl}`);
            authWindow.loadURL(authUrl);

            // 1. Intercept the Redirect
            authWindow.webContents.on('will-redirect', async (event, url) => {
                if (url.startsWith(REDIRECT_URI)) {
                    event.preventDefault();
                    console.log('[XboxAuth] Redirect intercepted!');
                    
                    // Show verify UI to prevent user panic
                    authWindow.webContents.executeJavaScript(`document.body.innerHTML = '<div style="color:white;background:#107C10;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><h1>Verifying Account...</h1></div>';`);

                    try {
                        const rawCode = url.split('code=')[1];
                        if (!rawCode) throw new Error('No code found in redirect URL');
                        
                        const code = rawCode.split('&')[0];
                        
                        // 2. Perform the Token Exchange Dance
                        const tokens = await this.performTokenDance(code);
                        
                        // 3. Get Profile (Gamertag + Avatar)
                        const profile = await this.fetchUserProfile(tokens);

                        // 4. SMART SWITCHING: Check for Duplicates
                        const existingAccounts = await getLinkedAccounts('xbox');
                        const isDuplicate = existingAccounts.some(acc => acc.external_id === tokens.xid);

                        if (isDuplicate) {
                            console.log(`[XboxAuth] Duplicate detected: ${profile.gamertag}. Forcing switch.`);
                            loopCount++;

                            if (loopCount > 2) {
                                throw new Error("Duplicate account loop detected. Please close and try again.");
                            }

                            // A. Clear Session to forget this user
                            const authSession = session.fromPartition('persist:valis_xbox');
                            await authSession.clearStorageData();

                            // B. Alert User
                            await authWindow.webContents.executeJavaScript(`
                                alert('Account "${profile.gamertag}" is already linked!\\n\\nPlease sign in with a DIFFERENT account.');
                            `);

                            // C. Reload Login Page (Now cleared)
                            authWindow.loadURL(authUrl);
                            return; // Stop here, do not resolve
                        }

                        // 5. Success - Close Window and Return
                        isResolved = true;
                        authWindow.close();

                        resolve({ 
                            ...tokens, 
                            gamertag: profile.gamertag || tokens.gamertag, // Prefer profile GT
                            avatarUrl: profile.avatarUrl 
                        });

                    } catch (err) {
                        console.error('[XboxAuth] Exchange failed:', err);
                        // If we are here, isResolved might be true (if we failed after setting it),
                        // but the promise is still pending because we haven't resolved yet.
                        // We must reject explicitly.
                        if (!authWindow.isDestroyed()) authWindow.close();
                        if (!isResolved) reject(err);
                    }
                }
            });
            
            authWindow.on('closed', () => {
                if (!isResolved) {
                    reject(new Error('Window closed by user'));
                }
            });
        });
    }

    async performTokenDance(authCode) {
        console.log('[XboxAuth] 💃 Starting Token Dance...');
        
        // A. MSA Token
        const msaParams = new URLSearchParams({
            client_id: CLIENT_ID,
            code: authCode,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
        });
        
        const msaResp = await axios.post('https://login.live.com/oauth20_token.srf', msaParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const accessToken = msaResp.data.access_token;
        if (!accessToken) throw new Error('MSA Failed: No access token');

        // B. XBL User Token
        const xblResp = await axios.post('https://user.auth.xboxlive.com/user/authenticate', {
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT",
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: `d=${accessToken}`
            }
        }, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });
        
        const xblToken = xblResp.data.Token;
        if (!xblToken) throw new Error('XBL Failed');

        // C. XSTS Token (The API Key)
        const xstsResp = await axios.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
            RelyingParty: "http://xboxlive.com",
            TokenType: "JWT",
            Properties: {
                UserTokens: [xblToken],
                SandboxId: "RETAIL"
            }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const xstsData = xstsResp.data;
        if (!xstsData.Token) throw new Error('XSTS Failed: Account might not have a Gamertag/Xbox Profile');

        return {
            xstsToken: xstsData.Token,
            userHash: xstsData.DisplayClaims.xui[0].uhs,
            gamertag: xblResp.data.DisplayClaims.xui[0].gtg, // Fallback from XBL response usually
            xid: xstsData.DisplayClaims.xui[0].xid
        };
    }

    async fetchUserProfile(tokens) {
        try {
            // We request 'Gamertag' and 'GameDisplayPicRaw'
            const url = `https://profile.xboxlive.com/users/xuid(${tokens.xid})/profile/settings?settings=Gamertag,GameDisplayPicRaw`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `XBL3.0 x=${tokens.userHash};${tokens.xstsToken}`,
                    'x-xbl-contract-version': '2'
                }
            });
            
            const data = response.data;
            const settings = data.profileUsers?.[0]?.settings || [];
            
            const gtSetting = settings.find(s => s.id === 'Gamertag');
            const picSetting = settings.find(s => s.id === 'GameDisplayPicRaw');
            
            return {
                gamertag: gtSetting ? gtSetting.value : null,
                avatarUrl: picSetting ? picSetting.value : null
            };
        } catch (e) {
            console.warn('[XboxAuth] Could not fetch profile settings:', e.message);
            return { gamertag: null, avatarUrl: null };
        }
    }
}

export default new XboxAuthService();
