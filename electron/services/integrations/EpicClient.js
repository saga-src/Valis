
import { BrowserWindow } from 'electron';

class EpicClient {
    
    async fetchLibrary(mainWindow, accountId) {
        console.log(`[EpicClient] Starting Harvest (English-Only) for: ${accountId}`);
        
        // Force English URL
        const targetUrl = `https://store.epicgames.com/en-US/u/${accountId}`;
        
        const syncWindow = new BrowserWindow({
            width: 1600,
            height: 1000,
            show: false, // Set to true if you want to verify visually
            parent: mainWindow,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false
            }
        });

        console.log('[EpicClient] Loading English Profile:', targetUrl);
        syncWindow.loadURL(targetUrl);

        const wait = (ms) => new Promise(r => setTimeout(r, ms));

        return new Promise(async (resolve, reject) => {
            const globalTimeout = setTimeout(() => {
                if (!syncWindow.isDestroyed()) syncWindow.close();
                resolve([]); 
            }, 900000); // 15 min timeout

            try {
                // --- STEP 1: LOAD & SCROLL ---
                console.log('[EpicClient] Waiting for render...');
                await wait(8000);
                
                // Force scroll to load all games (Lazy Loading)
                await syncWindow.webContents.executeJavaScript(`
                    new Promise(resolve => {
                        let totalHeight = 0;
                        const distance = 300;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if(totalHeight >= scrollHeight){
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100); 
                    })
                `);
                await wait(3000);

                // --- STEP 2: HARVEST URLS (FIXED SELECTOR) ---
                const gameLinks = await syncWindow.webContents.executeJavaScript(`
                    (() => {
                        try {
                            const all = Array.from(document.querySelectorAll('*'));
                            
                            // FIX: Broader keyword search based on your English screenshot
                            // Looking for "Total XP Earned" or "Achievement Progress"
                            const targets = all.filter(el => 
                                el.children.length === 0 && el.innerText && (
                                    el.innerText.includes('Total XP Earned') || 
                                    el.innerText.includes('Achievement Progress') ||
                                    el.innerText.includes('Achievements')
                                )
                            );

                            const games = [];
                            const seen = new Set();

                            targets.forEach(t => {
                                let parent = t.parentElement;
                                let rawUrl = null;
                                
                                // Traverse up to find Link (<a>)
                                for(let k=0; k<15; k++) {
                                    if(!parent) break;
                                    if(parent.tagName === 'A' && parent.href) { rawUrl = parent.href; break; }
                                    parent = parent.parentElement;
                                }

                                if(rawUrl) {
                                    try {
                                        const u = new URL(rawUrl);
                                        // Force path to /en-US/
                                        const path = u.pathname.split('/');
                                        if(path[1] && /^[a-z]{2}-[A-Z]{2}$/.test(path[1])) {
                                            path[1] = 'en-US';
                                        } else {
                                            path.splice(1, 0, 'en-US');
                                        }
                                        u.pathname = path.join('/');
                                        
                                        const finalUrl = u.href;

                                        // Filter out the "My Profile" link itself
                                        if (!seen.has(finalUrl) && !finalUrl.endsWith('/u/' + '${accountId}')) {
                                            seen.add(finalUrl);
                                            
                                            // Fallback title extraction from URL
                                            const slug = finalUrl.split('/').pop();
                                            const niceTitle = slug.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());

                                            games.push({ url: finalUrl, title: niceTitle });
                                        }
                                    } catch (err) {}
                                }
                            });
                            return games;
                        } catch (e) { return { error: e.message }; }
                    })()
                `);

                if (gameLinks.error) throw new Error(gameLinks.error);
                console.log(`[EpicClient] Found ${gameLinks.length} games.`);
                const finalLibrary = [];

                // --- STEP 3: VISIT & SCRAPE (STRICT ENGLISH) ---
                for (const game of gameLinks) {
                    console.log(`[EpicClient] Scanning: ${game.title}`);
                    await syncWindow.loadURL(game.url);
                    await wait(5000); 

                    const gameData = await syncWindow.webContents.executeJavaScript(`
                        (() => {
                            // BLOCKLIST
                            const BLOCKLIST = [
                                "Discover", "Browse", "News", "Wishlist", "Cart", 
                                "Achievements", "Friends", "Filter", "Sort by", 
                                "Progress", "Backlog", "Platinum"
                            ];

                            const h1 = document.querySelector('h1');
                            const title = h1 ? h1.innerText : "${game.title}";
                            
                            // Find all "XP" badges (Universal identifier)
                            const allDivs = Array.from(document.querySelectorAll('div'));
                            const xpBadges = allDivs.filter(d => /\\d+\\s*XP/i.test(d.innerText));

                            const unlockedList = [];
                            const seen = new Set();

                            xpBadges.forEach(badge => {
                                let row = badge.parentElement; 
                                for(let k=0; k<4; k++) { if(row && row.parentElement) row = row.parentElement; }

                                if(row) {
                                    const text = row.innerText;
                                    const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
                                    
                                    // Robust English Date Match
                                    // Matches "Unlocked Apr 20, 2023" or "Unlocked 20 Apr"
                                    const dateLine = lines.find(l => l.match(/^Unlocked\\s+/i));

                                    if(dateLine) {
                                        const name = lines[0]; 
                                        
                                        if(name && !seen.has(name) && !BLOCKLIST.includes(name)) {
                                            seen.add(name);
                                            unlockedList.push({
                                                name: name,         
                                                rawDate: dateLine   
                                            });
                                        }
                                    }
                                }
                            });

                            return {
                                title: title,
                                id: window.location.href.split('/').pop(),
                                achievementCount: unlockedList.length,
                                unlockedAchievements: unlockedList,
                                platform: 'epic'
                            };
                        })()
                    `);

                    if (gameData.id) {
                        console.log(`   -> Found ${gameData.achievementCount} unlocked achievements for ${gameData.title}.`);
                        finalLibrary.push(gameData);
                    }
                }

                console.log('[EpicClient] Sync Complete.');
                clearTimeout(globalTimeout);
                syncWindow.close();
                resolve(finalLibrary);

            } catch (err) {
                console.error('[EpicClient] Error:', err);
                if (!syncWindow.isDestroyed()) syncWindow.close();
                resolve([]);
            }
        });
    }
}

export default new EpicClient();
