import { BrowserWindow } from 'electron';
import { saveLinkedAccount } from '../../db/modules/settings.js';

const AUTH_TIMEOUT_MS = 5 * 60_000;
const IDENTITY_TIMEOUT_MS = 20_000;

export class EpicAuthService {
  async loginToEpic(mainWindow) {
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true,
        parent: mainWindow || undefined,
        title: 'Login to Epic Games',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          partition: 'persist:valis_epic'
        }
      });

      let settled = false;
      let extractionInFlight = false;
      let lastIdentityError = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        authWindow.webContents.removeListener('did-navigate', onNavigate);
        authWindow.webContents.removeListener('did-navigate-in-page', onNavigate);
        resolve(result);
        if (result.status !== 'cancelled' && !authWindow.isDestroyed()) authWindow.close();
      };

      const readIdentity = async () => {
        if (settled || extractionInFlight || authWindow.isDestroyed()) return;
        extractionInFlight = true;
        try {
          const userData = await authWindow.webContents.executeJavaScript(`
            new Promise((resolve) => {
              const startedAt = Date.now();
              const inspect = () => {
                const nameInput = document.querySelector('input[name="displayName"]');
                const bodyText = document.body?.innerText || '';
                const idMatch = bodyText.match(/(?:Account\\s+)?ID:\\s*([a-f0-9]{32})/i);
                if (idMatch || Date.now() - startedAt >= ${IDENTITY_TIMEOUT_MS - 250}) {
                  resolve({
                    id: idMatch?.[1] || null,
                    display_name: nameInput?.value?.trim() || null
                  });
                  return;
                }
                setTimeout(inspect, 250);
              };
              inspect();
            })
          `);

          if (!userData?.id) {
            const error = new Error('Epic account page loaded, but the account identifier was not found.');
            error.code = 'EPIC_IDENTITY_SELECTOR_MISSING';
            throw error;
          }

          const username = userData.display_name || 'Epic Games User';
          await saveLinkedAccount({
            platform: 'epic',
            external_id: userData.id,
            username,
            avatar_url: '',
            auth_data: JSON.stringify({ method: 'visual_account_page', last_login: Date.now() }),
            created_at: Date.now()
          });
          finish({ success: true, status: 'complete', message: `Connected as ${username}` });
        } catch (error) {
          lastIdentityError = { code: error.code || 'EPIC_IDENTITY_READ_FAILED', message: error.message };
        } finally {
          extractionInFlight = false;
        }
      };

      const onNavigate = (_event, url) => {
        if (/epicgames\.com\/(?:account|id)\/(?:personal|account)/i.test(url)) void readIdentity();
      };

      const timeoutHandle = setTimeout(() => {
        finish({
          success: false,
          status: 'timeout',
          message: 'Epic sign-in timed out before identity could be confirmed.',
          error: lastIdentityError
        });
        if (!authWindow.isDestroyed()) authWindow.close();
      }, AUTH_TIMEOUT_MS);

      authWindow.webContents.on('did-navigate', onNavigate);
      authWindow.webContents.on('did-navigate-in-page', onNavigate);
      authWindow.once('closed', () => {
        finish({ success: false, status: 'cancelled', message: 'Window closed' });
      });
      authWindow.loadURL('https://www.epicgames.com/id/login').catch((error) => {
        finish({ success: false, status: 'error', message: 'Epic sign-in page could not be loaded.', error: { code: 'EPIC_AUTH_NAV_FAILED', message: error.message } });
      });
    });
  }
}

export default new EpicAuthService();
