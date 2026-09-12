import { BrowserWindow } from 'electron';
import { classifyEpicProfileSnapshot, EPIC_PROGRESS_CHANNEL } from './EpicSyncUtils.js';

const NAVIGATION_TIMEOUT_MS = 30_000;
const DOM_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 10 * 60_000;

function abortError(reason) {
  const timedOut = reason === 'timeout';
  const error = new Error(timedOut ? 'Epic sync timed out.' : 'Epic sync was cancelled.');
  error.code = timedOut ? 'EPIC_TIMEOUT' : 'EPIC_CANCELLED';
  return error;
}

function withDeadline(promise, timeoutMs, signal, code) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      handler(value);
    };
    const timer = setTimeout(() => {
      const error = new Error(`${code} exceeded ${timeoutMs}ms.`);
      error.code = code;
      finish(reject, error);
    }, timeoutMs);
    const onAbort = () => finish(reject, abortError(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then((value) => finish(resolve, value), (error) => finish(reject, error));
  });
}

function sendProgress(sender, data) {
  if (sender && !sender.isDestroyed?.()) sender.send(EPIC_PROGRESS_CHANNEL, data);
}

async function waitForProfileSnapshot(webContents, signal) {
  return withDeadline(webContents.executeJavaScript(`
    new Promise((resolve) => {
      const startedAt = Date.now();
      const inspect = () => {
        const bodyText = document.body?.innerText || '';
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const links = [];
        const seen = new Set();
        let selectorMatched = false;

        for (const anchor of anchors) {
          const text = anchor.innerText || '';
          const href = anchor.href || '';
          if (/achievement|total xp earned/i.test(text) || /achievement/i.test(href)) {
            selectorMatched = true;
            try {
              const url = new URL(href);
              const parts = url.pathname.split('/').filter(Boolean);
              const slug = parts.at(-1);
              if (!slug || seen.has(url.href)) continue;
              seen.add(url.href);
              links.push({
                url: url.href,
                title: anchor.getAttribute('aria-label') || text.trim() || slug.replace(/-/g, ' ')
              });
            } catch {}
          }
        }

        const terminalText = /private|privacy settings|not public|no games|no achievements|hasn['’]t earned|0 games/i.test(bodyText);
        if (links.length || terminalText || Date.now() - startedAt >= ${DOM_TIMEOUT_MS - 250}) {
          resolve({ links, bodyText: bodyText.slice(0, 4000), selectorMatched });
          return;
        }
        setTimeout(inspect, 250);
      };
      inspect();
    })
  `), DOM_TIMEOUT_MS, signal, 'EPIC_PROFILE_DOM_TIMEOUT');
}

async function extractGame(webContents, fallbackTitle, signal) {
  const safeFallbackTitle = JSON.stringify(String(fallbackTitle || 'Epic game'));
  return withDeadline(webContents.executeJavaScript(`
    new Promise((resolve) => {
      const startedAt = Date.now();
      const inspect = () => {
        const bodyText = document.body?.innerText || '';
        const rows = Array.from(document.querySelectorAll('[data-testid*=achievement], li, article, div'));
        const unlockedAchievements = [];
        const seen = new Set();

        for (const row of rows) {
          const text = row.innerText || '';
          if (!/\\bUnlocked\\s+/i.test(text) || !/\\d+\\s*XP/i.test(text)) continue;
          const lines = text.split('\\n').map((line) => line.trim()).filter(Boolean);
          const rawDate = lines.find((line) => /^Unlocked\\s+/i.test(line));
          const name = lines.find((line) => line !== rawDate && !/\\d+\\s*XP/i.test(line));
          if (name && rawDate && !seen.has(name)) {
            seen.add(name);
            unlockedAchievements.push({ name, rawDate });
          }
        }

        if (unlockedAchievements.length || /achievement|no achievements/i.test(bodyText) || Date.now() - startedAt >= ${DOM_TIMEOUT_MS - 250}) {
          const url = new URL(window.location.href);
          resolve({
            title: document.querySelector('h1')?.innerText?.trim() || ${safeFallbackTitle},
            id: url.pathname.split('/').filter(Boolean).at(-1),
            unlockedAchievements
          });
          return;
        }
        setTimeout(inspect, 250);
      };
      inspect();
    })
  `), DOM_TIMEOUT_MS, signal, 'EPIC_GAME_DOM_TIMEOUT');
}

export class EpicClient {
  async fetchLibrary(mainWindow, accountId, sender) {
    const controller = new AbortController();
    let closingInternally = false;
    const failures = [];
    const syncWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      show: false,
      parent: mainWindow || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        partition: 'persist:valis_epic'
      }
    });

    syncWindow.once('closed', () => {
      if (!closingInternally && !controller.signal.aborted) controller.abort('cancelled');
    });
    const overallTimer = setTimeout(() => controller.abort('timeout'), OVERALL_TIMEOUT_MS);

    try {
      sendProgress(sender, { message: 'Connecting to Epic Games...', percent: 5, stage: 'profile' });
      const profileUrl = `https://store.epicgames.com/en-US/u/${encodeURIComponent(accountId)}`;
      await withDeadline(syncWindow.loadURL(profileUrl), NAVIGATION_TIMEOUT_MS, controller.signal, 'EPIC_PROFILE_NAV_TIMEOUT');
      sendProgress(sender, { message: 'Reading Epic profile...', percent: 15, stage: 'profile' });
      const snapshot = await waitForProfileSnapshot(syncWindow.webContents, controller.signal);
      const profileStatus = classifyEpicProfileSnapshot(snapshot);

      if (profileStatus !== 'complete') {
        return {
          status: profileStatus,
          games: [],
          discovered: 0,
          processed: 0,
          failures: profileStatus === 'error'
            ? [{ code: 'EPIC_PROFILE_SELECTOR_MISSING', message: 'Epic profile structure was not recognized.' }]
            : []
        };
      }

      const games = [];
      const total = snapshot.links.length;
      for (let index = 0; index < total; index += 1) {
        const link = snapshot.links[index];
        if (controller.signal.aborted) throw abortError(controller.signal.reason);
        sendProgress(sender, {
          message: `Reading Epic game ${index + 1} of ${total}`,
          current: index + 1,
          total,
          percent: 20 + Math.round(((index + 1) / total) * 65),
          stage: 'games'
        });
        try {
          await withDeadline(syncWindow.loadURL(link.url), NAVIGATION_TIMEOUT_MS, controller.signal, 'EPIC_GAME_NAV_TIMEOUT');
          const game = await extractGame(syncWindow.webContents, link.title, controller.signal);
          if (!game?.id) {
            const error = new Error('Epic game identifier was not found.');
            error.code = 'EPIC_GAME_ID_MISSING';
            throw error;
          }
          games.push(game);
        } catch (error) {
          if (error.code === 'EPIC_CANCELLED' || error.code === 'EPIC_TIMEOUT') throw error;
          failures.push({
            title: link.title,
            code: error.code || 'EPIC_GAME_READ_FAILED',
            message: error.message
          });
        }
      }

      return {
        status: failures.length ? 'partial' : 'complete',
        games,
        discovered: total,
        processed: total,
        failures
      };
    } catch (error) {
      const status = error.code === 'EPIC_CANCELLED'
        ? 'cancelled'
        : (error.code === 'EPIC_TIMEOUT' || /TIMEOUT/.test(error.code || '') ? 'timeout' : 'error');
      return {
        status,
        games: [],
        discovered: 0,
        processed: 0,
        failures: [{ code: error.code || 'EPIC_CLIENT_ERROR', message: error.message }]
      };
    } finally {
      clearTimeout(overallTimer);
      closingInternally = true;
      if (!syncWindow.isDestroyed()) syncWindow.close();
    }
  }
}

export default new EpicClient();
