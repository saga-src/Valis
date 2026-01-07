
import { BrowserWindow } from 'electron';
import { saveLinkedAccount } from '../../db/modules/settings.js';

class EpicAuthService {
    // Handles opening the login window and scraping the Account ID/Name
    async loginToEpic(mainWindow) {
        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 1000,
                height: 800,
                show: true,
                parent: mainWindow,
                title: 'Login to Epic Games',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: false,
                    partition: 'persist:valis_epic' // Critical: Use persistent session
                }
            });

            console.log('[EpicAuth] Opening Login Window...');
            authWindow.loadURL('https://www.epicgames.com/id/login');

            let isResolved = false;

            authWindow.webContents.on('did-navigate', async (event, url) => {
                // Wait for the standard Account Settings page
                if (url.includes('/account/personal') || url.includes('/id/personal')) {
                    if (isResolved) return;
                    console.log('[EpicAuth] Settings page detected. Reading Identity...');
                    
                    // Wait for the specific "Display Name" field to load
                    await new Promise(r => setTimeout(r, 2000));

                    try {
                        const userData = await authWindow.webContents.executeJavaScript(`
                            (() => {
                                // 1. Scrape Display Name
                                const nameInput = document.querySelector('input[name="displayName"]');
                                const name = nameInput ? nameInput.value : document.title.split('-')[0].trim();

                                // 2. Scrape Account ID (Look for "ID: [32-char hex]" pattern)
                                const bodyText = document.body.innerText;
                                const idMatch = bodyText.match(/ID:\\s*([a-f0-9]{32})/i);
                                const id = idMatch ? idMatch[1] : null;

                                return { id, display_name: name };
                            })()
                        `);

                        console.log('[EpicAuth] Scraped Identity:', userData);

                        if (!userData.id) {
                            throw new Error('Could not find Account ID on the page.');
                        }

                        // Prepare account object
                        const accountData = {
                            platform: 'epic',
                            external_id: userData.id,
                            username: userData.display_name,
                            avatar_url: '',
                            auth_data: JSON.stringify({ method: 'visual_scraper', last_login: Date.now() }),
                            created_at: Date.now()
                        };

                        // Save to DB so Sync Service can use it
                        await saveLinkedAccount(accountData);

                        isResolved = true;
                        resolve({ success: true, message: `Connected as ${userData.display_name}` });
                        authWindow.close();

                    } catch (error) {
                        console.error('[EpicAuth] Visual scraping failed:', error);
                        // Do not close immediately on error, allow user to perhaps navigate manually or retry
                    }
                }
            });

            authWindow.on('closed', () => {
                if (!isResolved) {
                    console.log('[EpicAuth] Login window closed.');
                    resolve({ success: false, message: 'Window closed' });
                }
            });
        });
    }
}

export default new EpicAuthService();
