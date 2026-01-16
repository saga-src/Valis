import { BrowserWindow } from 'electron';

class EpicClient {
    
    /**
     * Harvests library data from Epic Games public profile with real-time progress reporting.
     * @param {BrowserWindow} mainWindow Parent window for modal behavior
     * @param {string} accountId The Epic Account ID
     * @param {WebContents} sender IPC sender to transmit progress events
     */
    async fetchLibrary(mainWindow, accountId, sender) {
        console.log(`[EpicClient] Starting Harvest for: ${accountId}`);
        
        // Report initial status
        if (sender) sender.send('steam:sync-progress', { message: 'Connecting to Epic Games...', percent: 5 });

        // Force English URL
        const targetUrl = `https://store.epicgames.com/en-US/u/${accountId}`;
        
        const syncWindow = new BrowserWindow({
            width: 1600,
            height: 1000,
            show: false, // Keep hidden in production
            parent: mainWindow,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false
            }
        });

        syncWindow.loadURL(targetUrl);
        const wait = (ms) => new Promise(r => setTimeout(r, ms));

        return new Promise(async (resolve, reject) => {
            // 15 minute timeout
            const globalTimeout = setTimeout(() => {
                if (!syncWindow.isDestroyed()) syncWindow.close();
                resolve([]); 
            }, 900000); 

            try {
                // --- STEP 1: LOAD ---
                if (sender) sender.send('steam:sync-progress', { message: 'Loading Profile (Please wait)...', percent: 10 });
                await wait(8000);
                
                // --- STEP 2: SCROLL ---
                if (sender) sender.send('steam:sync-progress', { message: 'Scrolling to find all games...', percent: 15 });
                
                await syncWindow.webContents.executeJavaScript(`
                    new Promise(resolve => {
                        let totalHeight = 0;
                        const distance = 300;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            // Stop if bottom reached or sanity limit
                            if(totalHeight >= scrollHeight || totalHeight > 50000){
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100); 
                    })
                `);
                await wait(3000);

                // --- STEP 3: EXTRACT LINKS ---
                if (sender) sender.send('steam:sync-progress', { message: 'Extracting Game Links...', percent: 25 });
                
                const gameLinks = await syncWindow.webContents.executeJavaScript(`
                    (() => {
                        try {
                            const all = Array.from(document.querySelectorAll('*'));
                            
                            // Look for achievement-related keywords in elements
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
                                
                                // Traverse up to find link
                                for(let k=0; k<15; k++) {
                                    if(!parent) break;
                                    if(parent.tagName === 'A' && parent.href) { rawUrl = parent.href; break; }
                                    parent = parent.parentElement;
                                }

                                if(rawUrl) {
                                    try {
                                        const u = new URL(rawUrl);
                                        const pathSegments = u.pathname.split('/');
                                        // Ensure en-US locale for consistent scraping
                                        if(pathSegments[1] && /^[a-z]{2}-[A-Z]{2}$/.test(pathSegments[1])) {
                                            pathSegments[1] = 'en-US';
                                        } else {
                                            pathSegments.splice(1, 0, 'en-US');
                                        }
                                        u.pathname = pathSegments.join('/');
                                        const finalUrl = u.href;

                                        // Filter out own profile link
                                        if (!seen.has(finalUrl) && !finalUrl.endsWith('/u/' + '${accountId}')) {
                                            seen.add(finalUrl);
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
                
                const totalGames = gameLinks.length;
                if (sender) sender.send('steam:sync-progress', { message: `Found ${totalGames} games. Starting individual scans...`, percent: 30 });
                
                const finalLibrary = [];
                let processed = 0;

                // --- STEP 4: VISIT EACH GAME ---
                for (const game of gameLinks) {
                    if (syncWindow.isDestroyed()) break;
                    
                    processed++;
                    const percent = 30 + Math.round((processed / totalGames) * 60); // Scale from 30% to 90%
                    
                    if (sender) {
                        sender.send('steam:sync-progress', { 
                            message: `Scanning: ${game.title} (${processed}/${totalGames})`, 
                            percent: percent 
                        });
                    }

                    await syncWindow.loadURL(game.url);
                    await wait(4000); // Wait for dynamic content to load

                    const gameData = await syncWindow.webContents.executeJavaScript(`
                        (() => {
                            const BLOCKLIST = ["Discover", "Browse", "News", "Wishlist", "Cart", "Achievements", "Friends", "Filter", "Sort by", "Progress", "Backlog", "Platinum"];
                            const h1 = document.querySelector('h1');
                            const title = h1 ? h1.innerText : "${game.title}";
                            
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
                        finalLibrary.push(gameData);
                    }
                }

                if (sender) sender.send('steam:sync-progress', { message: 'Finalizing Library...', percent: 95 });
                
                clearTimeout(globalTimeout);
                if (!syncWindow.isDestroyed()) syncWindow.close();
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