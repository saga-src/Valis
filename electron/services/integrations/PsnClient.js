import { getUserTitles, getUserPlayedGames, getUserTrophiesEarnedForTitle, getTitleTrophies, getProfileFromAccountId } from "psn-api";

class PsnClient {
    /**
     * Shared normalization logic to ensure consistent matching across store and trophy lists.
     */
    normalizeTitle(str) {
        if (!str) return '';
        let s = str.toLowerCase()
            .replace(/[®™℠:：]/g, '')
            .replace(/'/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const suffixes = [' trophies', ' trophy set', ' complete edition', ' game of the year edition', ' goty edition', ' deluxe edition', ' standard edition', ' directors cut', ' remastered', ' bundle', ' collection'];
        for (const suffix of suffixes) {
            if (s.endsWith(suffix)) s = s.substring(0, s.length - suffix.length);
        }
        return s.trim();
    }

    getAccountIdFromToken(idToken) {
        if (!idToken) return null;
        try {
            const parts = idToken.split('.');
            if (parts.length !== 3) return null;
            const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
            return JSON.parse(payload).sub;
        } catch (e) { return null; }
    }

    async getProfile(tokens) {
        try {
            let accountId = this.getAccountIdFromToken(tokens.idToken) || this.getAccountIdFromToken(tokens.accessToken);
            if (!accountId) return { onlineId: 'PlayStation User' };
            const profile = await getProfileFromAccountId({ accessToken: tokens.accessToken }, accountId);
            let avatarUrl = '';
            if (profile.avatars?.length > 0) avatarUrl = profile.avatars[0].url;
            return { onlineId: profile.onlineId, avatarUrl, profilePicUrl: '' };
        } catch (e) { return { onlineId: 'PlayStation User' }; }
    }

    // --- HELPER: GENERIC PAGINATION ---
    // Loops until all items are fetched
    async fetchAll(auth, fetcher, ...args) {
        const limit = 200; 
        let offset = 0;
        let allItems = [];
        let keepGoing = true;

        while (keepGoing) {
            try {
                // Pass extra args (like npCommunicationId) followed by options
                const response = await fetcher(auth, ...args, { limit, offset });
                
                // Detect response array (it varies by endpoint)
                const items = response.titles || response.trophyTitles || response.trophies || [];
                allItems = allItems.concat(items);

                if (items.length < limit) {
                    keepGoing = false; 
                } else {
                    offset += limit;
                }
            } catch (e) {
                console.warn(`[PsnClient] Pagination stopped at ${offset}: ${e.message}`);
                keepGoing = false;
            }
        }
        return allItems;
    }

    async fetchLibrary(authorization) {
        console.log('--- 🔍 DIAGNOSTIC MODE STARTED 🔍 ---');
        
        // 1. Fetch Store List (Paginated)
        const storeMap = new Map();
        try {
            const playedGames = await this.fetchAll(authorization, getUserPlayedGames, "me");
            console.log(`[Store List] Fetched ${playedGames.length} TOTAL games.`);
            
            playedGames.forEach(t => {
                if (t.name && t.concept && t.concept.id) {
                    const cleanId = String(t.concept.id).split('.')[0];
                    const normName = this.normalizeTitle(t.name);
                    
                    // STORE BOTH ID AND DURATION
                    storeMap.set(normName, { 
                        id: cleanId, 
                        duration: t.playDuration // e.g., "PT50H"
                    });
                }
            });
        } catch (e) { console.error('Store Fetch Failed:', e.message); }

        // 2. Fetch Trophy List (Paginated)
        let trophyList = [];
        try {
             trophyList = await this.fetchAll(authorization, getUserTitles, "me");
             console.log(`[Trophy List] Fetched ${trophyList.length} TOTAL trophy lists.`);
        } catch(e) { console.error('Trophy Fetch Failed:', e.message); }

        // 3. Merge
        const games = [];
        for (const t of trophyList) {
            const cleanKey = this.normalizeTitle(t.trophyTitleName);
            const storeData = storeMap.get(cleanKey);

            games.push({
                titleName: t.trophyTitleName,
                cleanName: cleanKey,
                npCommunicationId: t.npCommunicationId,
                npServiceName: t.npServiceName,
                platform: t.trophyTitlePlatform, 
                progress: t.progress,
                conceptId: storeData ? storeData.id : null,
                playDuration: storeData ? storeData.duration : null
            });
        }
        
        console.log('--- 🔍 DIAGNOSTIC MODE END 🔍 ---');
        return games; 
    }

    /**
     * Searches for a specific game in the user's trophy list to retrieve its IDs.
     */
    async findTrophyTitle(authorization, gameName) {
        if (!gameName) return null;
        
        const target = this.normalizeTitle(gameName);
        console.log(`[PsnClient] Searching for trophy title matching: "${target}"`);

        try {
            // Check the last 100 titles (usually enough for recently added games)
            const response = await getUserTitles(authorization, "me", { limit: 100 });
            const titles = response.trophyTitles || [];

            for (const t of titles) {
                if (this.normalizeTitle(t.trophyTitleName) === target) {
                    console.log(`[PsnClient] Found match: ${t.trophyTitleName} (${t.npCommunicationId})`);
                    return t;
                }
            }
        } catch (e) {
            console.error('[PsnClient] findTrophyTitle failed:', e.message);
        }
        
        return null;
    }

    // --- FIX: PAGINATED TROPHY DETAILS ---
    async fetchEarnedTrophies(authorization, npCommunicationId, npServiceName) {
        // Fetch ALL earned status
        const limit = 100;
        let offset = 0;
        let totalItems = [];
        let active = true;

        while(active) {
            try {
                const res = await getUserTrophiesEarnedForTitle(
                    authorization, 
                    "me", 
                    npCommunicationId, 
                    "all", 
                    { npServiceName, limit, offset }
                );
                totalItems = totalItems.concat(res.trophies);
                if(res.trophies.length < limit) active = false;
                else offset += limit;
            } catch (e) {
                console.warn(`[PsnClient] Error fetching earned trophies at offset ${offset}: ${e.message}`);
                active = false;
            }
        }

        return totalItems.map(t => ({ id: t.trophyId, earned: t.earned, earnedDateTime: t.earnedDateTime, type: t.trophyType }));
    }

    async fetchTrophyDefinitions(authorization, npCommunicationId, npServiceName) {
        // Fetch ALL definitions (Names, Icons, etc.)
        const limit = 100;
        let offset = 0;
        let totalItems = [];
        let active = true;

        while(active) {
            try {
                const res = await getTitleTrophies(
                    authorization, 
                    npCommunicationId, 
                    "all", 
                    { npServiceName, limit, offset }
                );
                totalItems = totalItems.concat(res.trophies);
                if(res.trophies.length < limit) active = false;
                else offset += limit;
            } catch (e) {
                console.warn(`[PsnClient] Error fetching trophy definitions at offset ${offset}: ${e.message}`);
                active = false;
            }
        }

        return totalItems.map(t => ({ id: t.trophyId, name: t.trophyName, description: t.trophyDetail, iconUrl: t.trophyIconUrl, isHidden: t.trophyHidden }));
    }
}

export default new PsnClient();