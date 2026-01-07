
import { BrowserWindow, session } from 'electron';
import { 
    exchangeNpssoForAccessCode, 
    exchangeAccessCodeForAuthTokens, 
    exchangeRefreshTokenForAuthTokens 
} from "psn-api";

class PsnAuthService {
    /**
     * Opens an interactive window to capture the NPSSO cookie.
     */
    async getNpsso() {
        console.log('[PsnAuth] Starting Login (Strategy: Clean Window)...');
        
        // 1. STANDARD SESSION
        // We use a persistent partition so it behaves like a real browser profile
        const psnSession = session.fromPartition('persist:psn_standard_v1');
        
        // 2. MINIMALIST USER AGENT
        // We set a standard Chrome UA, but we do NOT strip headers or tamper with requests.
        // This prevents the "Mismatched Headers" block.
        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        psnSession.setUserAgent(USER_AGENT);

        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 1000, 
                height: 800,
                show: true,
                title: "Login to PlayStation Network",
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    session: psnSession,
                    // We DO NOT disable automation features. 
                    // Sometimes hiding them is more suspicious than keeping them.
                    sandbox: true 
                }
            });

            // 3. CLEAN START
            // We clear cookies to ensure the login form appears
            authWindow.webContents.session.clearStorageData({ storages: ['cookies'] });

            let isResolved = false;

            // 4. PASSIVE COOKIE LISTENER
            // Instead of spamming the server with checks, we listen for changes locally.
            // This is invisible to the website.
            const cookieListener = (event, cookie, cause, removed) => {
                if (removed) return;
                
                if (cookie.domain.includes('sony.com') && cookie.name === 'npsso') {
                    if (cookie.value && cookie.value.length > 10) {
                        console.log('[PsnAuth] ✅ NPSSO Cookie detected via Event Listener!');
                        isResolved = true;
                        
                        // Clean up listener
                        psnSession.cookies.off('changed', cookieListener);
                        
                        authWindow.destroy();
                        resolve(cookie.value);
                    }
                }
            };

            // Attach the listener
            psnSession.cookies.on('changed', cookieListener);

            // 5. THE TARGET
            // We go to the homepage, exactly like the manual flow.
            const loginUrl = 'https://www.playstation.com/';
            console.log(`[PsnAuth] Loading: ${loginUrl}`);
            authWindow.loadURL(loginUrl, { userAgent: USER_AGENT });

            // Safety: Remove listener if window closes
            authWindow.on('closed', () => {
                psnSession.cookies.off('changed', cookieListener);
                // We don't reject immediately, just in case it was a valid close
                // But generally, if resolved wasn't called, it's a cancellation
                setTimeout(() => {
                    if (!isResolved) {
                        reject(new Error("USER_CLOSED_WINDOW"));
                    }
                }, 500);
            });
        });
    }

    async authenticate(npsso) {
        try {
            console.log('[PsnAuth] Exchanging NPSSO for tokens...');
            const accessCode = await exchangeNpssoForAccessCode(npsso);
            const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
            
            console.log('[PsnAuth] Authentication successful.');
            return {
                accessToken: authorization.accessToken,
                refreshToken: authorization.refreshToken,
                idToken: authorization.idToken, // <--- CRITICAL ADDITION
                expiresIn: authorization.expiresIn
            };
        } catch (error) {
            console.error('[PsnAuth] Auth Exchange Failed:', error);
            throw new Error(`Auth Failed: ${error.message}`);
        }
    }

    async refresh(refreshToken) {
        try {
            console.log('[PsnAuth] Refreshing tokens...');
            const authorization = await exchangeRefreshTokenForAuthTokens(refreshToken);
            return {
                accessToken: authorization.accessToken,
                refreshToken: authorization.refreshToken,
                idToken: authorization.idToken, // <--- CRITICAL ADDITION
                expiresIn: authorization.expiresIn
            };
        } catch (error) {
            console.error('[PsnAuth] Refresh Failed:', error);
            throw error;
        }
    }
}

export default new PsnAuthService();
