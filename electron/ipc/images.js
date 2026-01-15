
import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { updateGameLocalCover, migrateCoverColumn } from '../db/queries.js';

const CACHE_DIR = path.join(app.getPath('userData'), 'cache', 'covers');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 🟢 1. QUEUE SYSTEM
const MAX_CONCURRENT = 5;
let activeRequests = 0;
const queue = [];

const processQueue = async () => {
    if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;

    activeRequests++;
    const { task, resolve, reject } = queue.shift();

    try {
        await task();
        resolve();
    } catch (err) {
        reject(err);
    } finally {
        activeRequests--;
        processQueue();
    }
};

const addToQueue = (task) => {
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        processQueue();
    });
};

export function registerImageHandlers() {

  // Run migration on startup just in case
  migrateCoverColumn();

  // 🟢 2. BULK CACHER (Triggered on Start/Sync)
  ipcMain.handle('image:cache-library', async (_, games) => {
    if (!Array.isArray(games)) return { queued: false };
    
    // console.log(`[ImageCache] Checking ${games.length} games for missing covers...`);

    games.forEach(game => {
        if (!game.cover_url || !game.id) return;

        // 1. Sanity Check: If DB has path, does file actually exist?
        if (game.local_cover_path) {
             const diskPath = game.local_cover_path; // DB paths are already clean
             try {
                 const stats = fs.statSync(diskPath);
                 if (stats.size > 0) return; // ✅ All good, skip download
             } catch (e) {
                 // ❌ File missing/corrupt. Reset DB and continue to download.
                 console.log(`[ImageCache] Missing file for ${game.name}, redownloading...`);
                 updateGameLocalCover(game.id, null);
             }
        }

        // 2. Queue Download
        addToQueue(async () => {
            const urlObj = new URL(game.cover_url);
            const extension = path.extname(urlObj.pathname) || '.jpg';
            const fileName = `${game.id}${extension}`;
            const filePath = path.join(CACHE_DIR, fileName);

            try {
                // Check disk one last time (Async)
                try {
                    const stats = await fs.promises.stat(filePath);
                    if (stats.size > 0) {
                        // We have file, but DB didn't know? Update DB.
                        updateGameLocalCover(game.id, filePath);
                        return;
                    }
                    await fs.promises.unlink(filePath).catch(() => {});
                } catch(e) {}

                // Download
                const response = await fetch(game.cover_url);
                if (!response.ok) return;
                
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                // Write File
                await fs.promises.writeFile(filePath, buffer);
                
                // ✅ Update DB immediately
                updateGameLocalCover(game.id, filePath);
                // console.log(`[ImageCache] Saved: ${game.name}`);

            } catch (e) {
                console.error(`[ImageCache] Failed ${game.name}:`, e.message);
            }
        });
    });

    return { queued: true };
  });

  // (Removed image:get-path handler as it is no longer needed)
}
