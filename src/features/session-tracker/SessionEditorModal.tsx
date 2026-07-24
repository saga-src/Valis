
import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { Clock, Calendar, Save, Tag, BookOpen, Gamepad2, Smile, ArrowRight, RefreshCw, X, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { CUSTOM_PLATFORM_DATA, CUSTOM_PLATFORMS } from '../../types/index';
import { useMarkObserver } from '../../features/gamification/hooks/useMarkObserver';
import { useAuth } from '../../context/AuthContext';
import { useSocialBroadcast } from '../social/hooks/useSocialBroadcast';
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
  const safeTotal = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const h = Math.floor(safeTotal / 3600);
  const m = Math.floor((safeTotal % 3600) / 60);
  const s = safeTotal % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const hmsToSeconds = (str: string) => {
  const parts = str.split(':').map(Number);
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isFinite(part) || part < 0 || !Number.isInteger(part)) ||
    parts[1] > 59 ||
    parts[2] > 59
  ) {
    return null;
  }

  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
};

const getSecondsFromMidnight = (timeStr: string) => {
  // timeStr is HH:mm or HH:mm:ss
  const parts = timeStr.split(':').map(Number);
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((part) => !Number.isFinite(part) || !Number.isInteger(part))
  ) {
    return null;
  }

  const h = parts[0];
  const m = parts[1];
  const s = parts[2] ?? 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
    return null;
  }

  return (h * 3600) + (m * 60) + s;
};

const formatTimeInput = (secondsFromMidnight: number) => {
  // Wraps to 24h
  let s = secondsFromMidnight;
  while (s < 0) s += 86400;
  s = s % 86400;
  return secondsToHms(s);
};

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatDateTimeInput = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const parseLocalDateTime = (date: string, time: string) => {
  const parsed = new Date(`${date}T${time}`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
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
  const { broadcastSession } = useSocialBroadcast();

  // --- STATE ---
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:00');
  const [durationStr, setDurationStr] = useState('00:00:00');
  const [timeError, setTimeError] = useState<string | null>(null);
  
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

        setDate(formatDateInput(start));
        setStartTime(formatDateTimeInput(start));
        setEndTime(formatDateTimeInput(end));
        setDurationStr(secondsToHms(dur));
        setTimeError(null);

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
        
        setDate(formatDateInput(now));
        setStartTime(formatDateTimeInput(now));
        setEndTime(formatDateTimeInput(oneHourLater));
        setDurationStr('01:00:00');
        setTimeError(null);
        
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
    if (startSec === null || durSec === null) {
      setTimeError('Use valid Start and Duration values in HH:mm:ss.');
      return;
    }

    setTimeError(null);
    const endSec = startSec + durSec;
    setEndTime(formatTimeInput(endSec));
  };

  // 2. Changing Duration -> Updates End Time (Start Time Preserved)
  const handleDurationBlur = () => {
    const startSec = getSecondsFromMidnight(startTime);
    const durSec = hmsToSeconds(durationStr);
    if (startSec === null || durSec === null) {
      setTimeError('Use a non-negative Duration in HH:mm:ss.');
      return;
    }

    setTimeError(null);
    const endSec = startSec + durSec;
    setEndTime(formatTimeInput(endSec));
  };

  // 3. Changing End Time -> Updates Duration (Start Time Preserved)
  const handleEndTimeBlur = () => {
    const startSec = getSecondsFromMidnight(startTime);
    let endSec = getSecondsFromMidnight(endTime);
    if (startSec === null || endSec === null) {
      setTimeError('Use valid Start and End values in HH:mm:ss.');
      return;
    }
    
    // Handle day wrap (e.g. 23:00 -> 01:00 is 2 hours, not -22 hours)
    if (endSec < startSec) {
        endSec += 86400; 
    }
    
    const diff = endSec - startSec;
    setTimeError(null);
    setDurationStr(secondsToHms(diff));
  };

  const handleStartNow = () => {
    const durationSeconds = hmsToSeconds(durationStr);
    if (durationSeconds === null) {
      setTimeError('Use a non-negative Duration in HH:mm:ss.');
      return;
    }

    const now = new Date();
    const startSeconds = getSecondsFromMidnight(formatDateTimeInput(now));
    if (startSeconds === null) return;

    setDate(formatDateInput(now));
    setStartTime(formatDateTimeInput(now));
    setEndTime(formatTimeInput(startSeconds + durationSeconds));
    setTimeError(null);
  };

  const handleEndNow = () => {
    const now = new Date();
    const start = parseLocalDateTime(date, startTime);
    setEndTime(formatDateTimeInput(now));

    if (!start) {
      setTimeError('Choose a valid Date and Start before setting End to now.');
      return;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - start.getTime()) / 1000),
    );
    setDurationStr(secondsToHms(elapsedSeconds));
    setTimeError(null);
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
    const startObj = parseLocalDateTime(date, startTime);
    if (!startObj) {
      setTimeError('Choose a valid Date and Start before saving.');
      return;
    }

    const timestamp = startObj.getTime();
    const happenedAt = startObj.toISOString();

    // Duration
    const durationSeconds = hmsToSeconds(durationStr);
    if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      setTimeError('Use a non-negative Duration in HH:mm:ss.');
      return;
    }
    setTimeError(null);

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
        // Resolve Game Data (if missing)
        let targetGame = game;
        if (!targetGame && gameId && window.api) {
             try { targetGame = await window.api.getGameById(gameId); } catch { /* ignore */ }
        }

        if (!targetGame) return;

        // Resolve Platform Name
        let platformName = targetGame.platform || 'Unknown';
        if (platformId && CUSTOM_PLATFORM_DATA[platformId as number]) {
            platformName = CUSTOM_PLATFORM_DATA[platformId as number].name;
        }

        // Calculate XP
        const calculateXp = (secs: number) => {
            const base = Math.floor((secs / 60) * 0.2);
            if (base === 0 && secs > 300) return 1;
            return base;
        };
        const xpEarned = calculateXp(durationSeconds);

        // --- BROADCAST SESSION TO SOCIAL FEED ---
        broadcastSession(
            targetGame.title || targetGame.name,
            durationSeconds,
            xpEarned,
            platformName,
            targetGame.cover_url || targetGame.cover?.url
        );

        if (!user) return;
        
        try {
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

            const tasks: Promise<any>[] = [];

            if (initialData) {
                // --- EDIT MODE (Stats Adjustment) ---
                const oldSeconds = initialData.durationSeconds || 0;
                const deltaSeconds = durationSeconds - oldSeconds;

                if (deltaSeconds !== 0) {
                    const oldXP = Math.floor((oldSeconds / 60) * 0.2);
                    const newXP = Math.floor((durationSeconds / 60) * 0.2);
                    const deltaXP = newXP - oldXP;

                    tasks.push(supabase.rpc('update_player_stats', { playtime: deltaSeconds, xp: deltaXP }));
                    tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: deltaSeconds }));
                    for (const g of genres) {
                        tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: deltaSeconds }));
                    }
                }
                
                // Update specific activity if it was found
                const oldHappenedAt = new Date(initialData.startTime).toISOString();
                tasks.push(
                    supabase.from('activities')
                        .update({ 
                            happened_at: happenedAt, 
                            data: {
                                game: targetGame.title || targetGame.name,
                                duration: durationSeconds,
                                cover_url: targetGame.cover_url || targetGame.cover?.url || '',
                                game_id: targetGame.igdb_id || targetGame.id,
                                platform: platformName,
                                notes: tags,
                                xp: xpEarned,
                                mood: mood
                            }
                        })
                        .eq('user_id', user.id)
                        .eq('type', 'session')
                        .eq('happened_at', oldHappenedAt)
                );

            } else {
                // --- ADD MODE (New Stats) ---
                tasks.push(supabase.rpc('update_player_stats', { playtime: durationSeconds, xp: xpEarned }));
                tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: durationSeconds }));
                for (const g of genres) {
                    tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: durationSeconds }));
                }

                // Activities table is handled via the broadcastSession call above which uses broadcast()
            }

            await Promise.all(tasks);
            await calculateAndSyncObsession(user.id);

        } catch (e) {
            console.error('[ManualSession] Cloud sync failure:', e);
        }
    })();
  };

  // --- DELETE HANDLER ---
  const handleDelete = () => {
      if (onDelete) onDelete();

      void (async () => {
        if (initialData && user) {
          try {
              let targetGame = game;
              if (!targetGame && gameId && window.api) {
                   try { targetGame = await window.api.getGameById(gameId); } catch { /* ignore */ }
              }

              if (targetGame) {
                  const seconds = initialData.durationSeconds || 0;
                  const xpToRemove = -Math.floor((seconds / 60) * 0.2);
                  const negSeconds = -seconds;

                  const getGenres = () => {
                      if (targetGame && targetGame.genres) {
                          try { return typeof targetGame.genres === 'string' ? JSON.parse(targetGame.genres).map((g: any) => g.name || g) : targetGame.genres; } catch { return []; }
                      }
                      return [];
                  };
                  const genres = getGenres();
                  
                  const tasks: Promise<any>[] = [];
                  tasks.push(supabase.rpc('update_player_stats', { playtime: negSeconds, xp: xpToRemove }));
                  tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: 'global', p_increment: negSeconds }));
                  for (const g of genres) {
                      tasks.push(supabase.rpc('update_leaderboard', { p_category: 'playtime', p_sub_category: g, p_increment: negSeconds }));
                  }

                  const originalDate = new Date(initialData.startTime).toISOString();
                  tasks.push(
                       supabase.from('activities')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('type', 'session')
                        .eq('happened_at', originalDate)
                  );

                  await Promise.all(tasks);
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
    { id: 130, name: 'Nintendo Switch' },
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
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Start</span>
                      <button
                        type="button"
                        onClick={handleStartNow}
                        className="flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary/80 transition-colors"
                        title="Set Start to the exact current time"
                        aria-label="Set Start to the exact current time"
                      >
                        <Clock size={10} /> Start Now
                      </button>
                    </div>
                    <input 
                        type="time" 
                        step="1"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setTimeError(null);
                        }}
                        onBlur={handleStartTimeBlur}
                        className="w-full bg-background border border-border rounded-lg p-2 text-center text-sm font-mono font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>

                <ArrowRight size={14} className="text-muted-foreground mt-4 opacity-50" />

                {/* End */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">End</span>
                      <button
                        type="button"
                        onClick={handleEndNow}
                        className="flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary/80 transition-colors"
                        title="Set End to the exact current time"
                        aria-label="Set End to the exact current time"
                      >
                        <Clock size={10} /> End Now
                      </button>
                    </div>
                    <input 
                        type="time" 
                        step="1"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setTimeError(null);
                        }}
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
                    onChange={(e) => {
                      setDurationStr(e.target.value);
                      setTimeError(null);
                    }}
                    onBlur={handleDurationBlur} // Calc End Time
                    placeholder="00:00:00"
                    className="w-full bg-background border border-border rounded-lg py-2.5 pl-20 pr-4 text-right text-sm font-mono font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
            </div>
            {timeError && (
              <p className="text-[10px] text-red-500 font-medium" role="alert">
                {timeError}
              </p>
            )}
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
