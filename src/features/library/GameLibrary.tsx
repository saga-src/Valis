import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '../../app/index';
import { 
    Search, SortAsc, SortDesc, SlidersHorizontal, LayoutGrid, List, Table,
    Dices, Sun, Moon, EyeOff, LayoutTemplate, Clock, Star, Layers
} from 'lucide-react';
import { useLibraryFilters } from './hooks/useLibraryFilters';
import { useTheme } from '../../lib/theme';
import { useSettings } from '../settings/useSettings';
import { useLibrarySettings, SortOption } from './hooks/useLibrarySettings';
import { GameCard } from './components/GameCard';
import { GameListRow } from './components/GameListRow';
import { DataRow } from './components/DataRow';
import { cn } from '../../lib/utils/cn';

// Modular Hooks and Utils
import { useLibraryData } from './hooks/useLibraryData';
import { useLibrarySort } from './hooks/useLibrarySort';
import { STORE_NAMES, getStatusColorVar } from './utils/libraryUtils';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';

export const GameLibrary: React.FC = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [filterStore, setFilterStore] = useState('All');
  
  const navigate = useNavigate();
  const { theme, changeTheme } = useTheme();
  const { libraryAction } = useSettings();
  const { settings, updateSettings } = useLibrarySettings();
  const { reportSignal } = useMarkObserver();

  // 1. Data Hook
  const { 
    games, 
    platforms, 
    stores, 
    genres, 
    themes, 
    lastPlayedMap, 
    loading 
  } = useLibraryData();

  // 2. Filter Hook
  const {
    filteredGames,
    search, setSearch,
    filterStatus, setFilterStatus,
    filterGenre, setFilterGenre,
    filterPlatform, setFilterPlatform,
    filterTheme, setFilterTheme
  } = useLibraryFilters(games, settings.showDlc);

  // Monitor Filters for Marks
  useEffect(() => {
    const activeFilters = [];
    if (filterStatus !== 'All') activeFilters.push('status');
    if (filterGenre !== 'All') activeFilters.push('genre');
    if (filterPlatform !== 'All') activeFilters.push('platform');
    if (filterTheme !== 'All') activeFilters.push('theme');
    if (filterStore !== 'All') activeFilters.push('store');
    
    if (activeFilters.length > 0) {
        reportSignal('FILTER_CHANGE', activeFilters);
    }
  }, [filterStatus, filterGenre, filterPlatform, filterTheme, filterStore, reportSignal]);

  // Monitor Data View for Marks
  useEffect(() => {
    let interval: any;
    if (settings.viewMode === 'data') {
        interval = setInterval(() => {
            reportSignal('PLAYTIME_TICK'); 
        }, 60000);
    }
    return () => clearInterval(interval);
  }, [settings.viewMode, reportSignal]);


  // 3. Store Sub-filtering
  const processedGames = useMemo(() => {
    if (filterStore === 'All') return filteredGames;
    return filteredGames.filter(game => {
      let ids: number[] = [];
      try { 
        ids = typeof game.owned_platform_ids === 'string' 
          ? JSON.parse(game.owned_platform_ids) 
          : game.owned_platform_ids || []; 
      } catch {}
      return ids.some(id => STORE_NAMES[Number(id)] === filterStore);
    });
  }, [filteredGames, filterStore]);

  // 4. Sorting Hook
  const displayedGames = useLibrarySort(processedGames, settings, lastPlayedMap);

  const statuses = ['All', 'Backlog', 'Playing', 'Beat', 'Completed', 'Dropped', 'Shelved', 'Endless'];
  const sortOptions: { value: SortOption; label: string }[] = [
      { value: 'added', label: 'Date Added' },
      { value: 'name', label: 'Name' },
      { value: 'score', label: 'Score' },
      { value: 'time', label: 'Time Played' },
      { value: 'release', label: 'Release Date' },
      { value: 'lastPlayed', label: 'Last Played' },
  ];

  const handleRandomGame = () => {
    if (displayedGames.length === 0) return;
    const randomGame = displayedGames[Math.floor(Math.random() * displayedGames.length)];
    
    reportSignal('RANDOM_GAME_PICK');

    if (libraryAction === 'play') {
      navigate('/play', { state: { gameId: randomGame.id } });
    } else {
      navigate(`/game/${randomGame.id}`);
    }
  };

  const cycleTheme = () => {
    let nextTheme: 'light' | 'dark' | 'stealth' = 'light';
    if (theme === 'light') nextTheme = 'dark';
    else if (theme === 'dark') nextTheme = 'stealth';
    
    changeTheme(nextTheme);
    reportSignal('THEME_CHANGE', nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
        case 'light': return <Sun size={20} className="text-orange-500" />;
        case 'dark': return <Moon size={20} className="text-blue-400" />;
        case 'stealth': return <EyeOff size={20} className="text-emerald-500" />;
    }
  };

  const handleViewChange = (mode: 'grid' | 'list' | 'data') => {
      updateSettings({ viewMode: mode });
      reportSignal('VIEW_MODE_UPDATE', mode);
  };

  const renderContent = () => {
    if (settings.viewMode === 'grid') {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
              {displayedGames.map((game, index) => (
                <div key={game.id} className={cn("game-card", index === 0 && "first-game-card")}>
                  <GameCard 
                      game={game} 
                      settings={settings} 
                      libraryAction={libraryAction}
                      theme={theme}
                  />
                </div>
              ))}
            </div>
        );
    }
    
    if (settings.viewMode === 'list') {
        return (
            <div className="flex flex-col gap-2">
                {displayedGames.map((game) => (
                    <GameListRow
                        key={game.id}
                        game={game}
                        settings={settings}
                        libraryAction={libraryAction}
                        theme={theme}
                    />
                ))}
            </div>
        );
    }

    // Data View (Privacy Grid)
    return (
        <div className="flex flex-col border rounded-lg overflow-hidden bg-background shadow-sm data-grid-container">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground font-telemetry">
                <div className="col-span-5">Identity</div>
                <div className="col-span-2">State</div>
                <div className="col-span-2">Telemetry</div>
                <div className="col-span-2 text-right">Era</div>
                <div className="col-span-1 text-right">Value</div>
            </div>
            <div className="flex flex-col">
                {displayedGames.map((game) => (
                    <DataRow key={game.id} game={game} />
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col gap-6 mb-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Vault</h1>
                <p className="text-muted-foreground mt-1">
                {displayedGames.length} {displayedGames.length === 1 ? 'game' : 'games'} 
                {games.length !== displayedGames.length && ` (of ${games.length} total)`}
                </p>
            </div>
            <button 
                onClick={cycleTheme}
                className="p-2 rounded-full hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
                {getThemeIcon()}
            </button>
          </div>
          
          <div className="flex gap-2">
             <button 
                onClick={handleRandomGame}
                disabled={displayedGames.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
             >
                <Dices size={16} />
                <span className="hidden sm:inline">Random</span>
             </button>
             
             <div className="flex bg-card border rounded-lg p-1">
                 <button 
                    onClick={() => handleViewChange('grid')}
                    title="Grid View"
                    className={cn(
                        "p-1.5 rounded transition-all",
                        settings.viewMode === 'grid' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                 >
                    <LayoutGrid size={16} />
                 </button>
                 <button 
                    onClick={() => handleViewChange('list')}
                    title="List View"
                    className={cn(
                        "p-1.5 rounded transition-all",
                        settings.viewMode === 'list' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                 >
                    <List size={16} />
                 </button>
                 <button 
                    onClick={() => handleViewChange('data')}
                    title="Data Grid (Stealth Priority)"
                    className={cn(
                        "p-1.5 rounded transition-all",
                        settings.viewMode === 'data' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                 >
                    <LayoutTemplate size={16} />
                 </button>
             </div>

             <button 
               onClick={() => setShowViewOptions(!showViewOptions)}
               className={cn(
                   "flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors",
                   showViewOptions ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
               )}
             >
                <Table size={16} />
             </button>

             <button 
               id="library-filter-bar"
               onClick={() => setShowFilters(!showFilters)}
               className={cn(
                   "flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors",
                   showFilters ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
               )}
             >
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline">Filters</span>
             </button>
          </div>
        </div>

        {showViewOptions && (
            <div className="bg-card border rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 flex flex-wrap gap-4 items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display:</span>
                
                <button
                    onClick={() => updateSettings({ showTime: !settings.showTime })}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                        settings.showTime ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted text-muted-foreground"
                    )}
                >
                    <Clock size={14} /> Playtime
                </button>

                <button
                    onClick={() => updateSettings({ showRating: !settings.showRating })}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                        settings.showRating ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted text-muted-foreground"
                    )}
                >
                    <Star size={14} /> Rating
                </button>

                <button
                    onClick={() => updateSettings({ showDlc: !settings.showDlc })}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                        settings.showDlc ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted text-muted-foreground"
                    )}
                >
                    <Layers size={14} /> Show DLCs
                </button>
            </div>
        )}

        {(showFilters || filterStatus !== 'All' || search) && (
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search titles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-lg bg-background w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    
                    <div className="flex overflow-x-auto pb-1 md:pb-0 gap-1 no-scrollbar">
                        {statuses.map(status => {
                            const color = getStatusColorVar(status);
                            const isActive = filterStatus === status;
                            return (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    style={{ 
                                        backgroundColor: isActive ? color : 'transparent',
                                        color: isActive ? 'white' : 'var(--muted-foreground)'
                                    }}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all border border-transparent",
                                        isActive 
                                            ? "shadow-md" 
                                            : "hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    {status}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 items-start">
                        {/* Genre */}
                        <div className="space-y-1 flex-1 min-w-[180px]">
                            <label className="text-xs font-semibold text-muted-foreground uppercase block h-4">Genre</label>
                            <select 
                                value={filterGenre}
                                onChange={(e) => setFilterGenre(e.target.value)}
                                className="w-full p-2 text-sm border rounded-lg bg-background cursor-pointer"
                            >
                                <option value="All">All Genres</option>
                                {genres.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        {/* Platform */}
                        <div className="space-y-1 flex-1 min-w-[180px]">
                            <label className="text-xs font-semibold text-muted-foreground uppercase block h-4">Platform</label>
                            <select 
                                value={filterPlatform}
                                onChange={(e) => {
                                    setFilterPlatform(e.target.value);
                                    setFilterStore('All'); 
                                }}
                                className="w-full p-2 text-sm border rounded-lg bg-background cursor-pointer"
                            >
                                <option value="All">All Platforms</option>
                                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        {/* Store */}
                        {filterPlatform.toLowerCase().includes('pc') && stores.length > 0 && (
                            <div className="space-y-1 flex-1 min-w-[180px] animate-in zoom-in-95 duration-200">
                                <label className="text-xs font-semibold text-muted-foreground uppercase block h-4 text-primary">Store</label>
                                <select 
                                    value={filterStore}
                                    onChange={(e) => setFilterStore(e.target.value)}
                                    className="w-full p-2 text-sm border border-primary/50 rounded-lg bg-background cursor-pointer"
                                >
                                    <option value="All">All Stores</option>
                                    {stores.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Theme */}
                        <div className="space-y-1 flex-1 min-w-[180px]">
                            <label className="text-xs font-semibold text-muted-foreground uppercase block h-4">Theme</label>
                            <select 
                                value={filterTheme}
                                onChange={(e) => setFilterTheme(e.target.value)}
                                className="w-full p-2 text-sm border rounded-lg bg-background cursor-pointer"
                            >
                                <option value="All">All Themes</option>
                                {themes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Sort By */}
                        <div className="space-y-1 flex-[1.5] min-w-[240px]">
                            <label className="text-xs font-semibold text-muted-foreground uppercase block h-4">Sort By</label>
                            <div className="flex gap-2">
                                <select 
                                    value={settings.sortBy}
                                    onChange={(e) => updateSettings({ sortBy: e.target.value as SortOption })}
                                    className="flex-1 p-2 text-sm border rounded-lg bg-background cursor-pointer"
                                >
                                    {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <div className="flex bg-muted rounded-lg p-1 border shrink-0">
                                     <button 
                                        onClick={() => updateSettings({ sortDirection: 'asc' })}
                                        className={cn("px-2 py-1 rounded hover:bg-background transition-colors", settings.sortDirection === 'asc' && "bg-background text-foreground shadow-sm")}
                                     >
                                         <SortAsc size={14} />
                                     </button>
                                     <button 
                                        onClick={() => updateSettings({ sortDirection: 'desc' })}
                                        className={cn("px-2 py-1 rounded hover:bg-background transition-colors", settings.sortDirection === 'desc' && "bg-background text-foreground shadow-sm")}
                                     >
                                         <SortDesc size={14} />
                                     </button>
                                 </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : displayedGames.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed rounded-xl">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <LayoutGrid className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No games match your filters</h3>
          <p className="text-muted-foreground mt-2">Try adjusting your search criteria or add a new game.</p>
          {(filterGenre !== 'All' || filterPlatform !== 'All' || filterTheme !== 'All' || filterStatus !== 'All' || search || filterStore !== 'All' || settings.showDlc) && (
              <button 
                onClick={() => {
                    setSearch('');
                    setFilterStatus('All');
                    setFilterGenre('All');
                    setFilterPlatform('All');
                    setFilterTheme('All');
                    setFilterStore('All');
                    // Reset showDlc via updateSettings if needed, or user toggles it manually
                }}
                className="mt-4 text-sm text-primary hover:underline"
              >
                  Clear all filters
              </button>
          )}
        </div>
      ) : renderContent()}
    </div>
  );
};
