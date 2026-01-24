import React, { useState, useMemo, useEffect } from 'react';
// Fix: Import useNavigate from local shim index file to avoid casing conflict with App.tsx
import { useNavigate } from '../../app/index';
import { useSessionManager } from './useSessionManager'; // Updated import
import { CUSTOM_PLATFORM_DATA, CUSTOM_PLATFORMS, PlatformOwnership } from '../../types/index';
import { Play, Tag, BookOpen, Clock, Gamepad2, Square, Rocket } from 'lucide-react';
import { getSessions, getGameTags } from '../../lib/storage';
import { System } from '../../lib/api';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils/cn';

interface SessionControlPanelProps {
  game: any;
  history?: any[]; // Optional to allow internal fetching if not provided
}

const MOODS = ['😶', '🤩', '🙂', '😐', '😴', '😡', '😭'];
const MOOD_LABELS: Record<string, string> = {
  '😶': 'No Emotion',
  '🤩': 'Amazing',
  '🙂': 'Good',
  '😐': 'Average',
  '😴': 'Boring',
  '😡': 'Frustrating',
  '😭': 'Sad'
};

export const SessionControlPanel: React.FC<SessionControlPanelProps> = ({ game, history: propHistory }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { reportSignal } = useMarkObserver();
  
  // Use Manager Hook (This ensures stopTimer broadcasts events)
  const { 
    activeSession, 
    startTimer,
    stopTimer,
    draft, 
    setDraftPlatform, 
    setDraftMood, 
    addDraftNote, 
    removeDraftNote, 
    setDraftJournal 
  } = useSessionManager();

  const [sessionHistory, setSessionHistory] = useState<any[]>(propHistory || []);
  const [tagInput, setTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  
  // Internal fetch of history if not provided (for Quick Play)
  useEffect(() => {
    if (!propHistory && game?.id) {
        // Fix: Ensure game.id is treated as string for getSessions
        getSessions(String(game.id)).then(data => setSessionHistory(data));
    } else if (propHistory) {
        setSessionHistory(propHistory);
    }
  }, [game?.id, propHistory]);

  // ⚡ NEW: Fetch tags from dedicated SQL table
  useEffect(() => {
    if (game?.id) {
        getGameTags(String(game.id)).then(setSuggestedTags);
    }
  }, [game?.id]);

  // ⚡ Robust Ownership Parsing
  const ownership: PlatformOwnership[] = useMemo(() => {
    if (!game) return [];
    try {
      System.log("Parsing Ownership for:", game?.title || game?.name);
      if (game.platform_ownership) {
        const parsed = typeof game.platform_ownership === 'string' 
          ? JSON.parse(game.platform_ownership) 
          : game.platform_ownership;
        return Array.isArray(parsed) ? parsed : [];
      } 
      
      if (game.owned_platform_ids) {
        const ids = typeof game.owned_platform_ids === 'string' 
          ? JSON.parse(game.owned_platform_ids) 
          : game.owned_platform_ids;
        return (Array.isArray(ids) ? ids : []).map((id: number) => ({ id, price: 0 }));
      }
    } catch (err) {
      System.error("CRASH during platform ownership parsing", err);
    }
    return [];
  }, [game]);

  // ⚡ Safe Default Platform Selection
  const defaultPlatformId = useMemo(() => {
    if (ownership && ownership.length > 0) {
      return ownership[0].id;
    }
    return CUSTOM_PLATFORMS.UNOFFICIAL;
  }, [ownership]);

  const [selectedPlatformId, setSelectedPlatformId] = useState<number>(draft.platformId || defaultPlatformId);

  // Sync selected platform if the game changes and no draft exists
  useEffect(() => {
    if (!draft.platformId || draft.platformId === 0) {
      setSelectedPlatformId(defaultPlatformId);
    }
  }, [defaultPlatformId, draft.platformId]);

  // Sync draft platform on change
  const handlePlatformChange = (id: number) => {
      setSelectedPlatformId(id);
      setDraftPlatform(id);
  };

  const handleMoodSelect = (m: string) => {
      setDraftMood(m);
      reportSignal('LOG_MOOD', m);
  };

  // Derived State
  const isSessionActive = activeSession?.gameId === String(game?.id);

  // Handlers
  const handleAddTag = (tag: string) => {
    const clean = tag.trim();
    if (clean && !draft.notes.includes(clean)) {
      addDraftNote(clean);
    }
    setTagInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
        handleAddTag(tagInput);
    }
  };

  const handleStart = () => {
    if (!game) return;
    // Ensure platform is set in draft
    setDraftPlatform(selectedPlatformId);
    // Start timer with Title and Cover for global display
    startTimer(String(game.id), game.title || game.name, game.cover_url, selectedPlatformId);
  };

  const handleLaunch = async () => {
    if (!game.executable) return;
    if (window.api && window.api.launchGame) {
      const res = await window.api.launchGame(game.id);
      if (res.success) {
        toast.success(`Launching ${game.title || game.name}...`);
        reportSignal('GAME_LAUNCH');
      } else {
        toast.error(`Launch failed: ${res.error}`);
      }
    }
  };

  const getPlatformName = (id: number) => {
    if (CUSTOM_PLATFORM_DATA[id]) return CUSTOM_PLATFORM_DATA[id].name;
    try {
        const platforms = JSON.parse(game?.platforms || '[]');
        const p = platforms.find((p: any) => p.id === id);
        if (p) return p.name;
    } catch {}
    return `ID: ${id}`;
  };

  if (!game) return null;

  return (
    <div className="bg-card border rounded-xl p-6 shadow-md flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="mb-6 border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
                {isSessionActive ? (
                    <span className="flex items-center gap-2 text-red-500 animate-pulse">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                        Recording Session
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        <Play size={20} className="text-primary" /> New Session
                    </span>
                )}
            </h3>
            {game.executable && (
                <button
                    onClick={handleLaunch}
                    disabled={isSessionActive}
                    title={isSessionActive ? "Game is already running" : "Launch Game"}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        isSessionActive ? "opacity-50 cursor-not-allowed grayscale" : "hover:bg-emerald-500/20"
                    )}
                >
                    <Rocket size={14} /> Launch Game
                </button>
            )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 pl-7">
          {isSessionActive ? 'Timer is running... Good luck!' : 'Configure your session details below.'}
        </p>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-1">
        
        {/* Row 1: Platform & Mood */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                 <Gamepad2 size={10} /> Platform
               </label>
               <select 
                 className="w-full p-2.5 bg-background border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
                 onChange={(e) => handlePlatformChange(Number(e.target.value))}
                 value={selectedPlatformId}
                 disabled={isSessionActive}
               >
                 {ownership.length > 0 ? (
                     ownership.map(p => (
                       <option key={p.id} value={p.id}>
                         {getPlatformName(p.id)}
                       </option>
                     ))
                 ) : (
                    <option value={CUSTOM_PLATFORMS.UNOFFICIAL}>☠️ Unofficial Copy</option>
                 )}
               </select>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mood</label>
                <div className="flex justify-between bg-background border rounded-lg p-1.5">
                  {MOODS.map(m => (
                    <button
                      key={m}
                      onClick={() => handleMoodSelect(m)}
                      className={`text-xl transition-all hover:scale-110 active:scale-95 ${draft.mood === m ? 'scale-125 drop-shadow-md opacity-100' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                      title={MOOD_LABELS[m] || m}
                    >
                      {m}
                    </button>
                  ))}
                </div>
            </div>
        </div>

        {/* Row 2: Tags */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Tag size={10} /> Tags
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/50 transition-all min-h-[52px]">
            {draft.notes.map(note => (
              <span key={note} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-md flex items-center gap-1 animate-in zoom-in-90">
                {note}
                <button onClick={() => removeDraftNote(note)} className="hover:text-destructive transition-colors ml-1 font-bold">×</button>
              </span>
            ))}
            <input 
              type="text" 
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={draft.notes.length === 0 ? "Add tags..." : "Add another..."}
              className="flex-1 bg-transparent outline-none min-w-[80px] text-sm"
            />
          </div>
          
          {/* Tag Suggestions */}
          {suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground py-0.5">Known Tags:</span>
                  {suggestedTags.map(tag => (
                      <button 
                        key={tag} 
                        onClick={() => handleAddTag(tag)}
                        disabled={draft.notes.includes(tag)}
                        className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                          {tag}
                      </button>
                  ))}
              </div>
          )}
        </div>

        {/* Row 3: Journal */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <BookOpen size={10} /> Journal Notes
          </label>
          <textarea 
            value={draft.journal}
            onChange={(e) => setDraftJournal(e.target.value)}
            placeholder="Log your progress, thoughts, or what you want to achieve..."
            className="w-full h-24 p-3 bg-background border rounded-lg resize-none outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
          />
        </div>

      </div>

      {/* Footer Actions */}
      <div className="pt-4 mt-2 border-t border-border/50">
        {!isSessionActive ? (
            <button
                onClick={handleStart}
                className="w-full py-4 bg-primary text-primary-foreground text-lg font-black rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 group"
            >
                <Play fill="currentColor" className="group-hover:scale-110 transition-transform" />
                START SESSION
            </button>
        ) : (
            <div className="flex gap-3">
                <button
                    onClick={() => stopTimer()}
                    className="flex-1 py-3 bg-destructive text-destructive-foreground font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                    <Square size={18} fill="currentColor" />
                    STOP SESSION
                </button>
                <button
                    onClick={() => navigate(`/game/${game.id}`)}
                    className="px-6 py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all"
                >
                    View Details
                </button>
            </div>
        )}
      </div>
    </div>
  );
};