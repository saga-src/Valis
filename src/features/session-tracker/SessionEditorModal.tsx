
import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { Clock, Calendar, Save, Tag, BookOpen, Gamepad2, Smile, ArrowRight, RefreshCw, X, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { CUSTOM_PLATFORM_DATA, CUSTOM_PLATFORMS } from '../../types/index';
import { useMarkObserver } from '../../features/gamification/hooks/useMarkObserver';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/cloud/supabase';
import { calculateAndSyncObsession } from '../analytics/logic/obsessionCalculator';

interface SessionData {
  id?: string;
  startTime: number;
  durationSeconds: number;
  platformId?: number | null;
  mood?: string;
  notes?: string | string[]; // JSON string or array
  journal?: string;
}

interface SessionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete?: () => void;
  initialData?: SessionData | null;
  title?: string;
  availablePlatforms?: { id: number; name: string }[];
  suggestedTags?: string[];
  gameId?: string; // ID for context
  game?: any; // Full game object for genre access
}

const MOODS = ['🤩', '🙂', '😐', '😴', '😡', '😭'];

// --- TIME HELPERS ---

const pad = (n: number) => n.toString().padStart(2, '0');

const secondsToHms = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const hmsToSeconds = (str: string) => {
  const parts = str.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
};

const getSecondsFromMidnight = (timeStr: string) => {
  // timeStr is HH:mm or HH:mm:ss
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return (h * 3600) + (m * 60) + s;
};

const formatTimeInput = (secondsFromMidnight: number) => {
  // Wraps to 24h
  let s = secondsFromMidnight;
  while (s < 0) s += 86400;
  s = s % 86400;
  return secondsToHms(s);
};

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  initialData,
  title = "Session Details",
  availablePlatforms,
  suggestedTags = [],
  gameId,
  game
}) => {
  const { reportSignal } = useMarkObserver();
  const { user } = useAuth();

  // --- STATE ---
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:00');
  const [durationStr, setDurationStr] = useState('00:00:00');
  
  // Metadata
  const [platformId, setPlatformId] = useState<number | ''>('');
  const [mood, setMood] = useState('🙂');
  const [journal, setJournal] = useState('');
  
  // Tags (Chip Input)
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const start = new Date(initialData.startTime);
        const dur = initialData.durationSeconds || 0;
        const end = new Date(start.getTime() + dur * 1000);

        setDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
        setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`);
        setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`);
        setDurationStr(secondsToHms(dur));

        setPlatformId(initialData.platformId || '');
        setMood(initialData.mood || '🙂');
        
        // Handle tags (string or array -> array)
        let noteArray: string[] = [];
        if (Array.isArray(initialData.notes)) {
            noteArray = initialData.notes;
        } else if (typeof initialData.notes === 'string') {
            try {
                const parsed = JSON.parse(initialData.notes);
                if (Array.isArray(parsed)) noteArray = parsed;
                else noteArray = [initialData.notes].filter(Boolean);
            } catch {
                // Fallback for simple comma separated string
                noteArray = initialData.notes.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        setTags(noteArray);
        setJournal(initialData.journal || '');

      } else {
        // Defaults: Now, 1h duration
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 3600000);
        
        setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
        setStartTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(0)}`);
        setEndTime(`${pad(oneHourLater.getHours())}:${pad(oneHourLater.getMinutes())}:${pad(0)}`);
        setDurationStr('01:00:00');
        
        setPlatformId('');
        setMood('🙂');
        setTags([]);
        setTagInput('');
        setJournal('');
      }
    }
  }, [isOpen, initialData]);

  // --- SMART LOGIC ---

  // 1. Changing Start Time -> Updates End Time (Duration Preserved)
  const handleStartTimeBlur = () => {
    const startSec = getSecondsFromMidnight(startTime);
    const durSec = hmsToSeconds(durationStr);
    const endSec = startSec + durSec;
    setEndTime(formatTimeInput(endSec));
  };

  // 2. Changing Duration -> Updates End Time (Start Time Preserved)
  const handleDurationBlur = () => {
    const startSec = getSecondsFromMidnight(startTime);
    const durSec = hmsToSeconds(durationStr);
    const endSec = startSec + durSec;
    setEndTime(formatTimeInput(endSec));
  };

  // 3. Changing End Time -> Updates Duration (Start Time Preserved)
  const handleEndTimeBlur = () => {
    const startSec = getSecondsFromMidnight(startTime);
    let endSec = getSecondsFromMidnight(endTime);
    
    // Handle day wrap (e.g. 23:00 -> 01:00 is 2 hours, not -22 hours)
    if (endSec < startSec) {
        endSec += 86400; 
    }
    
    const diff = endSec - startSec;
    setDurationStr(secondsToHms(diff));
  };

  // --- TAG HANDLERS ---
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const clean = tagInput.trim();
        if (clean && !tags.includes(clean)) {
            setTags([...tags, clean]);
            setTagInput('');
        }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
        setTags(tags.slice(0, -1));
    }
  };

  const addSuggestion = (tag: string) => {
    if (!tags.includes(tag)) {
        setTags([...tags, tag]);
        setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleMoodSelect = (m: string) => {
    setMood(m);
    reportSignal('LOG_MOOD', m);
  };

  // --- SAVE ---
  const handleSave = () => {
    if (!date || !startTime) return;

    // Construct Timestamp
    const dateTimeStr = `${date}T${startTime}`;
    const startObj = new Date(dateTimeStr);
    const timestamp = startObj.getTime();
    const happenedAt = startObj.toISOString();

    // Duration
    const durationSeconds = hmsToSeconds(durationStr);

    // 1. Prepare Local Data
    const sessionData = {
      timestamp,
      durationSeconds,
      platformId: platformId || null,
      mood,
      notes: tags, // Pass array directly
      journal
    };

    // 2. Optimistic UI Update (Instant Close)
    onSave(sessionData);

    // ⚡ Signals
    reportSignal('SESSION_SAVED', sessionData);
    if (journal.length > 0) {
        reportSignal('SAVE_JOURNAL', journal);
    }

    onClose();

    // 3. Background Network Operations (Fire-and-Forget)
    void (async () => {
        if (!user) return;
        
        try {
            console.log('[ManualSession] Background sync started...', { userId: user.id });

            // Resolve Game Data (if missing)
            let targetGame = game;
            if (!targetGame && gameId && window.api) {
                 try { targetGame = await window.api.getGameById(gameId); } catch { /* ignore */ }
            }

            if (!targetGame) {
                console.warn('Cannot broadcast to feed: Missing game data');
                return;
            }

            // Resolve Genres
            const getGenres = () => {
                if (targetGame && targetGame.genres) {
                    try { 
                      return typeof targetGame.genres === 'string' ? JSON.parse(targetGame.genres).map((g: any) => g.name || g) : targetGame.genres; 
                    } catch { return []; }
                }
                return [];
            };
            const genres = getGenres();

            // Resolve Platform Name
            let platformName = targetGame.platform || 'Unknown';
            if (platformId && CUSTOM_PLATFORM_DATA[platformId as number]) {
                platformName = CUSTOM_PLATFORM_DATA[platformId as number].name;
            }

            // Calculate XP for feed
            const xp = Math.floor(durationSeconds / 3600) * 10;

            // Metadata for Activity Feed
            const activityData = {
                game: targetGame.title || targetGame.name,
                duration: durationSeconds,
                cover_url: targetGame.cover_url || targetGame.cover?.url || '',
                game_id: targetGame.igdb_id || targetGame.id,
                platform: platformName,
                notes: tags,
                xp: xp,
                mood: mood
            };

            const tasks: Promise<any>[] = [];

            if (initialData) {
                // --- EDIT MODE ---
                const oldSeconds = initialData.durationSeconds || 0;
                const deltaSeconds = durationSeconds - oldSeconds;

                if (deltaSeconds !== 0) {
                    const oldXP = Math.floor(oldSeconds / 3600) * 10;
                    const newXP = Math.floor(durationSeconds / 3600) * 10;
                    const deltaXP = newXP - oldXP;

                    // A. Update Stats
                    tasks.push(
                        supabase.rpc('update_player_stats', { playtime: deltaSeconds, xp: deltaXP })
                            .then(({ error }) => error && console.error('Stats update failed:', error))
                    );
                    
                    // B. Global Leaderboard
                    tasks.push(
                        supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: deltaSeconds })
                            .then(({ error }) => error && console.error('Global LB failed:', error))
                    );
                    
                    // C. Genre Leaderboards
                    for (const g of genres) {
                        tasks.push(
                            supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: deltaSeconds })
                        );
                    }
                }

                // D. Update Activity Feed
                const oldHappenedAt = new Date(initialData.startTime).toISOString();
                tasks.push(
                    supabase.from('activities')
                        .update({ 
                            happened_at: happenedAt, 
                            data: activityData
                        })
                        .eq('user_id', user.id)
                        .eq('game_id', targetGame.id)
                        .eq('type', 'session')
                        .eq('happened_at', oldHappenedAt)
                        .then(({ error }) => error && console.error('Feed update failed:', error))
                );

            } else {
                // --- ADD MODE ---
                const xp = Math.floor(durationSeconds / 3600) * 10;
                
                // A. Update Stats
                tasks.push(
                    supabase.rpc('update_player_stats', { playtime: durationSeconds, xp: xp })
                        .then(({ error }) => error && console.error('Stats insert failed:', error))
                );

                // B. Global Leaderboard
                tasks.push(
                    supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: durationSeconds })
                        .then(({ error }) => error && console.error('Global LB insert failed:', error))
                );
                
                // C. Genre Leaderboards
                for (const g of genres) {
                    tasks.push(
                        supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: durationSeconds })
                    );
                }

                // D. Insert Activity Feed
                const activityPayload = {
                    user_id: user.id,
                    game_id: targetGame.id,
                    type: 'session',
                    happened_at: happenedAt,
                    data: activityData
                };
                tasks.push(
                    supabase.from('activities').insert(activityPayload)
                        .then(({ error }) => error && console.error('Feed insert failed:', error))
                );
            }

            // E. Execute all parallel
            await Promise.all(tasks);
            console.log('[ManualSession] Background sync complete.');
            
            // F. Trigger Obsession Update
            await calculateAndSyncObsession(user.id);

        } catch (e) {
            console.error('[ManualSession] Background sync critical failure:', e);
        }
    })();
  };

  // --- DELETE HANDLER ---
  const handleDelete = () => {
      // 1. Optimistic UI Update (Instant)
      if (onDelete) onDelete();

      // 2. Background Network Operations (Fire-and-Forget)
      void (async () => {
        if (initialData && user) {
          try {
              // Resolve Game
              let targetGame = game;
              if (!targetGame && gameId && window.api) {
                   try { targetGame = await window.api.getGameById(gameId); } catch { /* ignore */ }
              }

              if (targetGame) {
                  const seconds = initialData.durationSeconds || 0;
                  const xpToRemove = -Math.floor(seconds / 3600) * 10;
                  const negSeconds = -seconds;

                  const getGenres = () => {
                      if (targetGame && targetGame.genres) {
                          try { return typeof targetGame.genres === 'string' ? JSON.parse(targetGame.genres).map((g: any) => g.name || g) : targetGame.genres; } catch { return []; }
                      }
                      return [];
                  };
                  const genres = getGenres();
                  
                  console.log('[ManualSession] Background Deletion:', { playtime: negSeconds, xp: xpToRemove });

                  const tasks: Promise<any>[] = [];

                  // A. Revert Stats
                  tasks.push(supabase.rpc('update_player_stats', { playtime: negSeconds, xp: xpToRemove }));

                  // B. Revert Leaderboards
                  tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: negSeconds }));
                  for (const g of genres) {
                      tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: negSeconds }));
                  }

                  // C. Delete Activity Feed Entry
                  if (initialData.startTime) {
                       const originalDate = new Date(initialData.startTime).toISOString();
                       
                       tasks.push(
                           supabase.from('activities')
                            .delete()
                            .eq('user_id', user.id)
                            .eq('game_id', targetGame.id)
                            .eq('type', 'session')
                            .eq('happened_at', originalDate)
                       );
                  }

                  await Promise.all(tasks);
                  
                  // D. Update Obsession
                  await calculateAndSyncObsession(user.id);
              }
          } catch (e) {
              console.error('Failed to broadcast session deletion:', e);
          }
        }
      })();
  };

  // --- PLATFORM OPTIONS ---
  const defaultPlatforms = [
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.STEAM],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.EPIC],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.XBOX_PC],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.PSN],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.STANDALONE],
    { id: 130, name: 'Nintendo Switch' }, // Common static ID
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.UNOFFICIAL],
  ];

  const platforms = availablePlatforms || defaultPlatforms;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Session" : "Log Session"}>
      <div className="space-y-6">
        
        {/* ROW 1: Date */}
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Calendar size={12} /> Date
            </label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-sm font-medium focus:ring-1 focus:ring-primary outline-none transition-all"
            />
        </div>

        {/* ROW 2: The Triangle of Truth (Time Logic) */}
        <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-primary tracking-wider flex items-center gap-1.5">
                    <Clock size={12} /> Time & Duration
                </label>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                    <RefreshCw size={8} /> Auto-Calc Active
                </div>
            </div>
            
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                {/* Start */}
                <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Start</span>
                    <input 
                        type="time" 
                        step="1"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        onBlur={handleStartTimeBlur}
                        className="w-full bg-background border border-border rounded-lg p-2 text-center text-sm font-mono font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>

                <ArrowRight size={14} className="text-muted-foreground mt-4 opacity-50" />

                {/* End */}
                <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">End</span>
                    <input 
                        type="time" 
                        step="1"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        onBlur={handleEndTimeBlur} // Calc Duration
                        className="w-full bg-background border border-border rounded-lg p-2 text-center text-sm font-mono font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
            </div>

            {/* Duration Row */}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">Duration</span>
                <input 
                    type="text" 
                    value={durationStr}
                    onChange={(e) => setDurationStr(e.target.value)}
                    onBlur={handleDurationBlur} // Calc End Time
                    placeholder="00:00:00"
                    className="w-full bg-background border border-border rounded-lg py-2.5 pl-20 pr-4 text-right text-sm font-mono font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
            </div>
        </div>

        {/* ROW 3: Platform & Mood */}
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Gamepad2 size={12} /> Platform
                </label>
                <select
                    value={platformId}
                    onChange={(e) => setPlatformId(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm cursor-pointer outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="">Select...</option>
                    {platforms.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Smile size={12} /> Mood
                </label>
                <div className="flex justify-between bg-background border border-border rounded-lg p-1.5">
                    {MOODS.map(m => (
                        <button
                            key={m}
                            onClick={() => handleMoodSelect(m)}
                            type="button"
                            className={cn(
                                "text-lg hover:scale-125 transition-transform",
                                mood === m ? "scale-110 opacity-100 drop-shadow-md" : "opacity-40 grayscale hover:grayscale-0 hover:opacity-100"
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* ROW 4: Tags & Journal */}
        <div className="space-y-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Tag size={12} /> Tags
                </label>
                <div className="p-2 bg-background border border-border rounded-lg min-h-[42px] flex flex-wrap gap-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                    {tags.map((tag, i) => (
                        <span key={i} className="bg-secondary text-secondary-foreground border border-border/50 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 animate-in zoom-in-50">
                            {tag}
                            <button onClick={() => removeTag(i)} className="hover:text-destructive transition-colors"><X size={12} /></button>
                        </span>
                    ))}
                    <input 
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder={tags.length === 0 ? "Type tag and press Enter..." : ""}
                        className="flex-1 bg-transparent outline-none text-sm min-w-[120px] placeholder:text-muted-foreground/50"
                    />
                </div>
                {/* Suggestions */}
                {suggestedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-muted-foreground self-center">Recent:</span>
                        {suggestedTags.filter(t => !tags.includes(t)).slice(0, 5).map(tag => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => addSuggestion(tag)}
                                className="text-xs border border-dashed border-muted-foreground/50 px-2 py-0.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <BookOpen size={12} /> Journal Entry
                </label>
                <textarea 
                    value={journal}
                    onChange={(e) => setJournal(e.target.value)}
                    placeholder="Log your thoughts, milestones, or bugs encountered..."
                    className="w-full h-24 bg-background border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder:text-muted-foreground/50 leading-relaxed"
                />
            </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/50 items-center">
          {initialData && onDelete && (
            <button 
              type="button"
              onClick={handleDelete}
              className="mr-auto text-red-500 hover:bg-red-500/10 hover:text-red-600 px-3 py-2 rounded-md flex items-center gap-2 transition-colors text-xs font-bold"
            >
                <Trash2 size={14} /> Delete
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors text-foreground"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <Save size={16} />
            Save Session
          </button>
        </div>

      </div>
    </Modal>
  );
};
