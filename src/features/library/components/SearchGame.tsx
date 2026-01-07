
import React, { useState } from 'react';
import { searchGames, getCoverUrl } from '../../../lib/api/igdb';
import { IGDBGame } from '../../../types/igdb';
import { PlatformOwnership } from '../../../types/index';
import { PlatformSelector } from './PlatformSelector';
import { X, Save, Search } from 'lucide-react';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';
import { useToast } from '../../../context/ToastContext';
import { useMarkObserver } from '../../gamification/hooks/useMarkObserver';
import { useGameActions } from '../../game-details/hooks/useGameActions';

// 1. Define PC Store Mapping
const STORE_MAP: Record<number, string> = {
  99001: 'steam',
  99002: 'epic',
  99003: 'gog',
  99004: 'xbox',
  99005: 'standalone',
  99999: 'unofficial',
  100000: 'steam_tools'
};

export const SearchGame: React.FC = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IGDBGame[]>([]);
  const [loading, setLoading] = useState(false);
  const { reportSignal } = useMarkObserver();
  
  // Modal State
  const [selectedGame, setSelectedGame] = useState<IGDBGame | null>(null);
  const [selectedOwnership, setSelectedOwnership] = useState<PlatformOwnership[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Hook for actions (ID not strictly needed for add, so passing empty string)
  const { addToLibrary } = useGameActions('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      let data: IGDBGame[] = [];

      // Prioritize Direct IPC call if available
      if (window.api && window.api.searchGame) {
         const ipcResults = await window.api.searchGame(query);
         // Map Electron results to IGDBGame structure
         data = ipcResults.map((r: any) => ({
            id: Number(r.id),
            name: r.name, // Updated to use 'name' instead of 'title'
            cover: r.cover_url ? { url: r.cover_url } : undefined,
            first_release_date: r.first_release_date,
            total_rating: r.rating,
            platforms: r.platforms || [] // Now included from backend
         }));
      } else {
         // Fallback to library logic (for Web Dev mode via Proxy)
         data = await searchGames(query);
      }
      
      setResults(data);

      if (data.length === 0) {
        reportSignal('SEARCH_QUERY', { results: 0, context: 'ADD_GAME' });
      }

    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openSaveModal = (game: IGDBGame) => {
    setSelectedGame(game);
    
    // Pre-select the first platform if available, BUT skip generic PC (6)
    if (game.platforms && game.platforms.length > 0) {
        const firstId = game.platforms[0].id;
        if (firstId !== 6) { 
            setSelectedOwnership([{ id: firstId, price: 0 }]);
        } else {
            setSelectedOwnership([]); // Let user pick the specific store
        }
    } else {
        setSelectedOwnership([]);
    }
  };

  const closeSaveModal = () => {
    if (isSaving) return; // Prevent closing while saving
    setSelectedGame(null);
    setSelectedOwnership([]);
  };

  const handleConfirmSave = async () => {
    if (!selectedGame) return;
    setIsSaving(true);
    try {
      // A. Detect Store & Primary Platform
      let detectedStore = 'manual';
      let primaryPlatformId = 'unknown';

      // Check if any selected ownership is a PC Store
      const pcStoreId = selectedOwnership.find(p => STORE_MAP[p.id]);

      if (pcStoreId) {
          // It's a PC Game
          detectedStore = STORE_MAP[pcStoreId.id];
          primaryPlatformId = '6'; // Force IGDB PC ID for metadata linking
      } else if (selectedOwnership.length > 0) {
          // It's a Console Game
          primaryPlatformId = String(selectedOwnership[0].id);
          detectedStore = 'console'; 
      } else if (selectedGame.platforms && selectedGame.platforms.length > 0) {
          // Fallback to IGDB data if user selected nothing
          primaryPlatformId = String(selectedGame.platforms[0].id);
      }

      const gamePayload = {
        id: String(selectedGame.id),
        name: selectedGame.name,
        cover_url: selectedGame.cover?.url,
        first_release_date: selectedGame.first_release_date,
        rating: selectedGame.total_rating,
        
        // ⚡ METADATA
        platforms: selectedGame.platforms,
        
        // ⚡ OWNERSHIP (Backend maps this to owned_platform_ids JSON)
        platform_ownership: selectedOwnership, 
        
        // ⚡ DERIVED FIELDS
        platform_id: primaryPlatformId,
        store: detectedStore,
        
        status: 'Backlog',
        added_at: Date.now()
      };

      // Use Hook to Add (handles DB, Broadcast, Cloud Sync)
      await addToLibrary(gamePayload);

      closeSaveModal();
      
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to save: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-full flex flex-col">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Search className="text-primary" /> Add Games
      </h1>
      
      {/* Search Input */}
      <div className="relative group mb-8 z-20">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title..."
          className="w-full pl-12 pr-4 py-4 bg-background border-2 border-input rounded-2xl focus:border-primary focus:ring-0 outline-none shadow-sm text-lg font-medium transition-all text-foreground placeholder:text-muted-foreground"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button 
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            >
            {loading ? '...' : 'Search'}
            </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-10">
        {results.map((game) => (
          <button 
            key={game.id} 
            onClick={() => openSaveModal(game)}
            className="group flex flex-col text-left bg-card hover:bg-popover border border-border hover:border-primary/50 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 relative"
          >
            {/* Image Container */}
            <div className="relative w-full aspect-[3/4] bg-muted overflow-hidden">
              {game.cover ? (
                  <img 
                    src={getCoverUrl(game.cover.url)} 
                    alt={game.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
              ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-4 text-center">
                      No Image
                  </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      Add to Vault
                  </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-bold text-sm md:text-base leading-tight mb-2 line-clamp-2 text-foreground group-hover:text-primary transition-colors" title={game.name}>
                {game.name}
              </h3>
              
              <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">
                    {game.first_release_date 
                    ? new Date(game.first_release_date * 1000).getFullYear() 
                    : 'TBA'}
                  </span>
                  {game.total_rating && (
                      <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                          ★ {Math.round(game.total_rating)}
                      </span>
                  )}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {results.length === 0 && !loading && query && (
         <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-muted/10 mx-auto w-full max-w-lg">
            <p className="text-muted-foreground">No games found for "{query}".</p>
         </div>
      )}

      {/* Platform Selection Modal - Keeping existing logic, just wrapping in Fragment/Container if needed */}
      {selectedGame && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          {isSaving && <LoadingOverlay message="Saving to database..." />}
          
          <div className="bg-popover text-popover-foreground w-full max-w-lg rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-lg truncate pr-4">Save "{selectedGame.name}"</h3>
              <button 
                onClick={closeSaveModal} 
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-muted-foreground mb-4">
                Select the platforms you own this game on to track value correctly.
              </p>
              
              <PlatformSelector 
                availablePlatforms={selectedGame.platforms || []}
                selectedOwnership={selectedOwnership}
                onChange={setSelectedOwnership}
              />
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 mt-auto">
              <button 
                onClick={closeSaveModal}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg disabled:opacity-50 transition-colors text-foreground"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm active:scale-95"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
