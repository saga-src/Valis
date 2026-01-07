
import React, { useState, useEffect, useMemo } from 'react';
// Fix: Import Link and useLocation from local shim index file to avoid casing conflict with App.tsx
import { Link, useLocation } from '../../app/index';
import { getLibrary, getAllSessions } from '../../lib/storage';
import { getCoverUrl } from '../../lib/api/igdb';
import { SessionControlPanel } from '../session-tracker/SessionControlPanel';
import { Search, Play, History, Clock, Radio, CalendarClock, Layout, Plus, CheckCircle2 } from 'lucide-react';
import { useSessionStore } from '../session-tracker/store';
import { cn } from '../../lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

export const QuickPlayPage: React.FC = () => {
  const location = useLocation();
  const { activeSession } = useSessionStore();
  const [library, setLibrary] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [libs, sessions] = await Promise.all([
          getLibrary(),
          getAllSessions()
        ]);
        setLibrary(libs);
        setAllSessions(sessions);
      } catch (e) {
        console.error("Failed to load data", e);
      }
    };
    load();
  }, []);

  /**
   * Handle Selection Priority:
   * 1. If we have a gameId in router state (explicit navigation), select it.
   * 2. Otherwise, if there's an active session, default to that game.
   */
  useEffect(() => {
    if (library.length === 0) return;

    const incomingId = location.state?.gameId;
    
    if (incomingId) {
      // Priority 1: Explicit navigation from Library/Add
      const target = library.find(g => g.id === incomingId);
      if (target) {
        setSelectedGame(target);
        setSearch('');
      }
    } else if (activeSession?.gameId && !selectedGame) {
      // Priority 2: Default to active session if nothing else is selected
      const activeGame = library.find(g => g.id === activeSession.gameId);
      if (activeGame) {
        setSelectedGame(activeGame);
      }
    }
  }, [location.state, library, activeSession?.gameId]);

  const filteredGames = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return library
        .filter(g => (g.title || g.name).toLowerCase().includes(q))
        .sort((a, b) => {
            const aTitle = (a.title || a.name).toLowerCase();
            const bTitle = (b.title || b.name).toLowerCase();
            const aStarts = aTitle.startsWith(q);
            const bStarts = bTitle.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        })
        .slice(0, 8);
  }, [search, library]);

  const recentGames = useMemo(() => {
    const uniqueIds = new Set<string>();
    const recents: any[] = [];
    const sortedSessions = [...allSessions].sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );

    for (const session of sortedSessions) {
        if (!uniqueIds.has(session.game_id)) {
            const game = library.find(g => g.id === session.game_id);
            if (game) {
                uniqueIds.add(session.game_id);
                recents.push({ ...game, lastPlayed: session.start_time });
            }
        }
        if (recents.length >= 6) break;
    }
    return recents;
  }, [allSessions, library]);

  const gameHistory = useMemo(() => {
    if (!selectedGame) return [];
    return allSessions
      .filter(s => s.game_id === selectedGame.id)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [selectedGame, allSessions]);

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-10 animate-in fade-in duration-500">
      
      {/* 1. SEARCH SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Find a Game</h2>
            {selectedGame && (
                <button 
                  onClick={() => setSelectedGame(null)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                    <Plus size={12} className="rotate-45" /> Clear Selection
                </button>
            )}
        </div>
        
        <div className="relative z-50 group">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search your library to start a session..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-card border-2 border-border rounded-2xl focus:border-primary focus:ring-0 outline-none shadow-sm text-lg font-medium transition-all"
            />
          </div>
          
          {search && filteredGames.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-card border-2 border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 origin-top z-[60]">
              {filteredGames.map(game => (
                <button
                  key={game.id}
                  onClick={() => {
                    setSelectedGame(game);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left border-b border-border/50 last:border-0 group/item"
                >
                  <div className="w-10 h-14 shrink-0 rounded-lg overflow-hidden bg-muted shadow-sm border border-border/20">
                    <img src={getCoverUrl(game.cover_url)} className="w-full h-full object-cover transition-transform group-hover/item:scale-110" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-foreground block truncate group-hover/item:text-primary transition-colors">{game.title || game.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{game.status}</span>
                  </div>
                  {activeSession?.gameId === game.id && <Radio size={16} className="text-red-500 animate-pulse" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        
        {/* LEFT: SESSION CONTROL & SELECTED GAME INFO */}
        <div className="lg:col-span-2 space-y-6">
           {selectedGame ? (
              <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                {/* Visual Context */}
                <div className="bg-card border rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row h-auto md:h-48">
                    <div className="w-full md:w-36 h-48 md:h-full shrink-0 relative overflow-hidden">
                        <img 
                            src={getCoverUrl(selectedGame.cover_url, 'big')} 
                            className="w-full h-full object-cover" 
                            alt="" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded tracking-widest">Selected</span>
                           {activeSession?.gameId === selectedGame.id && (
                               <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded tracking-widest animate-pulse">
                                   <Radio size={10} /> Active
                               </span>
                           )}
                        </div>
                        <h2 className="text-3xl font-black text-foreground leading-tight truncate mb-1" title={selectedGame.title || selectedGame.name}>
                            {selectedGame.title || selectedGame.name}
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                            {selectedGame.status} 
                            {selectedGame.first_release_date && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-border" />
                                    {new Date(selectedGame.first_release_date * 1000).getFullYear()}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Control Panel */}
                <SessionControlPanel game={selectedGame} history={gameHistory} />
              </div>
           ) : (
             <div className="bg-card border-2 border-dashed border-border rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center space-y-6 group hover:border-primary/30 transition-colors">
                <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform duration-500">
                    <Layout size={40} strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-foreground">Track Your Progress</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                        Search for a game or select one from your recent history to log a new session and track your play hours.
                    </p>
                </div>
             </div>
           )}
        </div>

        {/* RIGHT: JUMP BACK IN (RECENT GAMES) */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <History size={16} className="text-primary" />
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Jump Back In</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            {recentGames.length > 0 ? recentGames.map(game => (
               <button 
                 key={game.id}
                 onClick={() => setSelectedGame(game)}
                 className={cn(
                    "group flex items-center gap-4 p-3 bg-card border rounded-2xl hover:border-primary/50 hover:shadow-md transition-all text-left relative overflow-hidden",
                    selectedGame?.id === game.id && "border-primary/50 ring-2 ring-primary/10 shadow-md bg-primary/5"
                 )}
               >
                 <div className="w-14 h-20 shrink-0 rounded-lg overflow-hidden border border-border/50 bg-muted">
                    <img 
                        src={getCoverUrl(game.cover_url)} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        alt=""
                    />
                 </div>
                 <div className="flex-1 min-w-0 pr-6">
                   <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{game.title || game.name}</h4>
                   <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1.5 uppercase tracking-tighter">
                       <Clock size={10} /> {formatDistanceToNow(new Date(game.lastPlayed))} ago
                   </p>
                   <div className="flex items-center gap-1.5 mt-2">
                       <div className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{game.status}</div>
                       {activeSession?.gameId === game.id && <Radio size={12} className="text-red-500 animate-pulse" />}
                   </div>
                 </div>
                 
                 {selectedGame?.id === game.id && (
                     <div className="absolute top-3 right-3 text-primary animate-in zoom-in-50">
                        <CheckCircle2 size={16} />
                     </div>
                 )}
               </button>
            )) : (
                <div className="p-8 text-center bg-muted/20 border-2 border-dashed border-border rounded-2xl opacity-50">
                    <CalendarClock size={24} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">No recent sessions</p>
                </div>
            )}
          </div>

          {/* Stats Summary Widget (Optional Visual) */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4">
             <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-wider text-primary">Library Pulse</h3>
             </div>
             <div className="space-y-1">
                <div className="text-2xl font-black text-foreground">
                    {allSessions.length}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Sessions Recorded</div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};