import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';
import { selectExecutable } from '../../../lib/storage';
import { Save, FolderOpen, FileCode, Clock, Plus, Trash2, Pencil, Gamepad2, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { formatDuration } from '../../../lib/utils/format';
import { cn } from '../../../lib/utils/cn';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/cloud/supabase';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';

interface EditGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: any;
  onSave: (updatedGame: any) => Promise<void>;
  onSaveSuccess?: () => void;
}

interface LegacyEntry {
  source: string;
  platform_id: number | null;
  seconds: number;
}

interface OwnedPlatform {
  id: number;
  acquired_price: number; // Updated field
  acquired_at?: number; 
}

// Master list reference for static fallback or name resolution
const STATIC_PLATFORM_NAMES: Record<number, string> = {
  99001: 'Steam',
  99002: 'Epic Games',
  99003: 'GOG',
  99004: 'Xbox (PC)',
  99005: 'Standalone',
  130: 'Nintendo Switch',
  167: 'PlayStation 5',
  48: 'PlayStation 4',
  12: 'Xbox Series X|S',
  49: 'Xbox One',
  100000: 'SteamTools',
  99999: 'Unofficial Copy'
};

export default function EditGameModal({ isOpen, onClose, game, onSave, onSaveSuccess }: EditGameModalProps) {
  const { toast } = useToast();
  const { broadcast } = useSocialBroadcast();
  const { user } = useAuth();

  const [title, setTitle] = useState(game?.title || '');
  const [status, setStatus] = useState(game?.status || 'Backlog');
  const [executable, setExecutable] = useState(game?.executable || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // --- ROBUST PARSER ---
  const parsePlatformData = (raw: any[]): OwnedPlatform[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((p: any) => ({
        // FIX: Use 'platform_id' (The real platform ID) first. 
        // Fallback to 'id' only if it's a simple list from frontend state.
        id: Number(p.platform_id ?? p.id),
        
        // FIX: Use 'acquired_price' (DB column) first. Fallback to 'price'.
        acquired_price: Number(p.acquired_price ?? p.price ?? 0),

        // Map acquired_at if present
        acquired_at: p.acquired_at ? Number(p.acquired_at) : undefined
    }));
  };

  // ⚡ Platform Ownership State
  const [ownedPlatforms, setOwnedPlatforms] = useState<OwnedPlatform[]>(() => {
    try {
        // Prioritize explicit ownership object, fall back to simple ID list
        if (game?.platform_ownership) {
            const raw = typeof game.platform_ownership === 'string' ? JSON.parse(game.platform_ownership) : game.platform_ownership;
            return parsePlatformData(raw);
        }
        if (game?.owned_platform_ids) {
            const ids = typeof game.owned_platform_ids === 'string' ? JSON.parse(game.owned_platform_ids) : game.owned_platform_ids;
            return (ids || []).map((id: any) => ({ id: Number(id), acquired_price: 0 }));
        }
        return [];
    } catch { return []; }
  });
  
  const [platformToAdd, setPlatformToAdd] = useState<string>('');
  const [priceToAdd, setPriceToAdd] = useState<string>('');
  const [dateToAdd, setDateToAdd] = useState<string>(''); // YYYY-MM-DD for input

  // ⚡ Legacy Playtime State (Array)
  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>(() => {
    if (!game?.legacy_playtime_seconds) return [];
    if (Array.isArray(game.legacy_playtime_seconds)) return game.legacy_playtime_seconds;
    if (typeof game.legacy_playtime_seconds === 'number') {
        return [{ source: 'Manual', platform_id: null, seconds: game.legacy_playtime_seconds }];
    }
    return [];
  });

  // New Entry State
  const [newSource, setNewSource] = useState('Manual');
  const [newHours, setNewHours] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [newSeconds, setNewSeconds] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
        setTitle(game?.title || '');
        setStatus(game?.status || 'Backlog');
        setExecutable(game?.executable || '');
        
        // Reset Platforms using robust parser
        try {
            if (game?.platform_ownership) {
                const raw = typeof game.platform_ownership === 'string' ? JSON.parse(game.platform_ownership) : game.platform_ownership;
                setOwnedPlatforms(parsePlatformData(raw));
            } else if (game?.owned_platform_ids) {
                const ids = typeof game.owned_platform_ids === 'string' ? JSON.parse(game.owned_platform_ids) : game.owned_platform_ids;
                setOwnedPlatforms((ids || []).map((id: any) => ({ id: Number(id), acquired_price: 0 })));
            } else {
                setOwnedPlatforms([]);
            }
        } catch { setOwnedPlatforms([]); }
        
        // Reset legacy
        if (Array.isArray(game.legacy_playtime_seconds)) setLegacyEntries(game.legacy_playtime_seconds);
        else if (typeof game.legacy_playtime_seconds === 'number') setLegacyEntries([{ source: 'Manual', platform_id: null, seconds: game.legacy_playtime_seconds }]);
        else setLegacyEntries([]);
        
        // Reset new entry inputs
        setNewHours('');
        setNewMinutes('');
        setNewSeconds('');
        setNewSource('Manual');
        setPlatformToAdd('');
        setPriceToAdd('');
        
        // Default date to today for easy adding
        setDateToAdd(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, game]);

  // Helper to safe parse JSON
  const safeParse = (json: any) => {
    try { return typeof json === 'string' ? JSON.parse(json) : json || []; } catch { return []; }
  };

  // Helper to resolve platform names
  const getPlatformName = (id: number) => {
    if (STATIC_PLATFORM_NAMES[id]) return STATIC_PLATFORM_NAMES[id];
    
    // Look in game metadata
    const platforms = safeParse(game?.platforms);
    const match = platforms.find((p: any) => p.id === id);
    return match?.name || match?.abbreviation || `ID: ${id}`;
  };

  // Helper to format timestamp for input (YYYY-MM-DD)
  const formatTimestampForInput = (ts: number | undefined) => {
    if (!ts) return '';
    try {
        return new Date(ts).toISOString().split('T')[0];
    } catch { return ''; }
  };

  // Derived Options for Legacy Dropdown
  const platformOptions = useMemo(() => {
    const ownedNames = ownedPlatforms.map(p => getPlatformName(p.id));
    const existingSources = legacyEntries.map(e => e.source);
    const unique = new Set(['Manual', ...ownedNames, ...existingSources]);
    return Array.from(unique);
  }, [ownedPlatforms, legacyEntries]);

  // ⚡ DYNAMIC AVAILABLE PLATFORMS
  const availableToAdd = useMemo(() => {
    const rawPlatforms = safeParse(game?.platforms);
    const options: { id: number; name: string }[] = [];

    // 1. Add Specific Platforms from Metadata
    rawPlatforms.forEach((p: any) => {
        // ID 6 is PC (Windows), we handle it via stores below
        if (p.id !== 6) {
            options.push({ id: p.id, name: p.name || p.abbreviation || `ID: ${p.id}` });
        }
    });

    // 2. If PC (6) exists in metadata, enable PC Stores
    const hasPc = rawPlatforms.some((p: any) => p.id === 6);
    if (hasPc) {
        options.push(
            { id: 99001, name: 'Steam' },
            { id: 99002, name: 'Epic Games' },
            { id: 99003, name: 'GOG' },
            { id: 99004, name: 'Xbox (PC)' },
            { id: 99005, name: 'Standalone' }
        );
    }

    // 3. Always add Utilities
    options.push(
        { id: 99999, name: 'Unofficial Copy' },
        { id: 100000, name: 'SteamTools' }
    );

    // 4. Filter out already owned
    return options.filter(p => !ownedPlatforms.some(op => op.id === p.id));
  }, [game, ownedPlatforms]);

  // --- Platform Handlers ---
  const handleAddPlatform = () => {
    const id = Number(platformToAdd);
    if (!id || ownedPlatforms.some(p => p.id === id)) return;
    
    const price = parseFloat(priceToAdd) || 0;
    const date = dateToAdd ? new Date(dateToAdd).getTime() : Date.now();

    setOwnedPlatforms([...ownedPlatforms, { id, acquired_price: price, acquired_at: date }]);
    
    // NEW: Broadcast acquisition
    const platformName = getPlatformName(id);
    broadcast('status', {
        game: title, // Use state title
        status: 'Acquired',
        detail: `Bought on ${platformName} for $${price.toFixed(2)}`
    });

    setPlatformToAdd('');
    setPriceToAdd('');
    // Keep dateToAdd as today/last selected for convenience
  };

  const handleRemovePlatform = (id: number) => {
    setOwnedPlatforms(prev => prev.filter(p => p.id !== id));
  };

  const handleEditPlatform = (id: number) => {
    const p = ownedPlatforms.find(op => op.id === id);
    if (!p) return;
    setPlatformToAdd(String(p.id));
    setPriceToAdd(String(p.acquired_price));
    if (p.acquired_at) {
        setDateToAdd(new Date(p.acquired_at).toISOString().split('T')[0]);
    }
    handleRemovePlatform(id); // Remove from list to allow re-adding updated version
  };
  
  // Handler to update date directly in the list
  const updatePlatformDate = (id: number, dateStr: string) => {
      const ts = dateStr ? new Date(dateStr).getTime() : undefined;
      setOwnedPlatforms(prev => prev.map(p => 
          p.id === id ? { ...p, acquired_at: ts } : p
      ));
  };

  // --- Legacy Handlers ---
  const handleAddEntry = () => {
    const h = parseInt(newHours) || 0;
    const m = parseInt(newMinutes) || 0;
    const s = parseInt(newSeconds) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;

    if (totalSeconds <= 0) {
        toast.error("Enter a valid time duration");
        return;
    }

    // ⚡ STRICT SOURCE NAME MATCHING (Ignoring platform_id/metadata)
    const existingIndex = legacyEntries.findIndex(e => 
      e.source?.toLowerCase().trim() === newSource.toLowerCase().trim()
    );

    if (existingIndex !== -1) {
        // Update existing source entry
        const updatedEntries = [...legacyEntries];
        updatedEntries[existingIndex] = { 
            ...updatedEntries[existingIndex], 
            seconds: totalSeconds 
        };
        setLegacyEntries(updatedEntries);
        toast.info(`Updated existing ${newSource} record`);
    } else {
        // Insert new entry
        setLegacyEntries([...legacyEntries, { source: newSource, platform_id: null, seconds: totalSeconds }]);
    }

    setNewHours('');
    setNewMinutes('');
    setNewSeconds('');
    setNewSource('Manual');
  };

  const handleEditEntry = (index: number) => {
    const entry = legacyEntries[index];
    setNewSource(entry.source);
    
    const h = Math.floor(entry.seconds / 3600);
    const m = Math.floor((entry.seconds % 3600) / 60);
    const s = Math.floor(entry.seconds % 60);
    
    setNewHours(String(h));
    setNewMinutes(String(m));
    setNewSeconds(String(s));
    
    // We don't remove here, handleAddEntry handles the upsert logic
  };

  const handleRemoveEntry = (index: number) => {
    setLegacyEntries(prev => prev.filter((_, i) => i !== index));
  };

  const formatLegacyTime = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = Math.floor(totalSeconds % 60);
      
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      if (s > 0) parts.push(`${s}s`);
      
      return parts.length > 0 ? parts.join(' ') : '0s';
  };

  const handleLinkExecutable = async () => {
    try {
      const fileName = await selectExecutable();
      if (fileName) {
        setExecutable(fileName);
      }
    } catch (e) {
      console.error("Failed to select executable", e);
      toast.error("Failed to select executable");
    }
  };

  const handleSave = async () => {
    // 1. Prepare Updated Data
    const updated = {
      ...game,
      title,
      status,
      skip_achievement_scan: true, // Signal backend to skip automated achievement scans for this update
      executable: executable || null,
      legacy_playtime_seconds: legacyEntries, // ⚡ Save Array
      platform_ownership: ownedPlatforms.map(p => ({
          id: p.id,            // This is the platform_id (e.g. 48)
          platform_id: p.id,   // Explicitly send platform_id for backend clarity
          acquired_price: p.acquired_price, // Correct DB column name
          acquired_at: p.acquired_at // New date field
      }))
    };

    // 2. Optimistic UI Update (Instant Close)
    setIsSaving(true);
    await onSave(updated);
    
    if (onSaveSuccess) onSaveSuccess();
    toast.success("Game details updated");
    onClose();
    setIsSaving(false);

    // 3. Background Broadcasts (Detached)
    void (async () => {
      if (!user) return;
      
      try {
          // Identify if we need to credit/debit completion stats
          let beatDelta = 0;
          let platinumDelta = 0;
          let xpDelta = 0;

          // Helper to check if a status counts as "Beaten"
          const isBeat = (s: string) => s === 'Beat' || s === 'Completed';

          if (isBeat(status) && !isBeat(game.status)) {
              // Game wasn't beaten, now it is -> Add Beat
              beatDelta = 1;
              xpDelta += 250;
              if (status === 'Completed') {
                  platinumDelta = 1;
                  xpDelta += 1000;
              }
          } else if (!isBeat(status) && isBeat(game.status)) {
              // Game was beaten, now it isn't -> Remove Beat
              beatDelta = -1;
              xpDelta -= 250;
              if (game.status === 'Completed') {
                  platinumDelta = -1;
                  xpDelta -= 1000;
              }
          } else if (status === 'Completed' && game.status === 'Beat') {
              // Upgraded to Platinum
              platinumDelta = 1;
              xpDelta += 1000;
          } else if (status === 'Beat' && game.status === 'Completed') {
              // Downgraded from Platinum
              platinumDelta = -1;
              xpDelta -= 1000;
          }

          if (beatDelta !== 0 || platinumDelta !== 0) {
              console.log('Broadcasting Game Status Update (Background):', { beatDelta, platinumDelta, xpDelta });
              
              const tasks: Promise<any>[] = [];

              // A. Stats
              const statsPayload: any = { xp: xpDelta };
              if (beatDelta !== 0) statsPayload.games_beaten = beatDelta;
              if (platinumDelta !== 0) statsPayload.platinum = platinumDelta;
              
              tasks.push(supabase.rpc('update_player_stats', statsPayload));

              // B. Leaderboards - Global
              if (beatDelta !== 0) {
                  tasks.push(supabase.rpc('update_leaderboard', { p_category: 'beats', p_sub_category: 'global', p_increment: beatDelta }));
              }
              if (platinumDelta !== 0) {
                  tasks.push(supabase.rpc('update_leaderboard', { p_category: 'platinum', p_sub_category: 'global', p_increment: platinumDelta }));
              }

              // C. Leaderboards - Genres
              let genres: any[] = [];
              try {
                  genres = typeof game.genres === 'string' ? JSON.parse(game.genres) : game.genres;
              } catch { /* ignore */ }
              
              if (Array.isArray(genres)) {
                  for (const g of genres) {
                      const genreName = typeof g === 'string' ? g : g.name;
                      if (genreName) {
                          if (beatDelta !== 0) {
                              tasks.push(supabase.rpc('update_leaderboard', { p_category: 'beats', p_sub_category: genreName, p_increment: beatDelta }));
                          }
                          if (platinumDelta !== 0) {
                              tasks.push(supabase.rpc('update_leaderboard', { p_category: 'platinum', p_sub_category: genreName, p_increment: platinumDelta }));
                          }
                      }
                  }
              }

              // D. Activity Feed (Only if positive change)
              if (beatDelta > 0 || platinumDelta > 0) {
                  const activityType = status === 'Completed' ? 'achievement' : 'status';
                  const detail = status === 'Completed' ? 'Achieved 100% Completion' : 'Beat the game';
                  
                  tasks.push(supabase.from('activities').insert({
                      user_id: user.id,
                      game_id: game.id,
                      type: activityType,
                      data: {
                          game: game.title || game.name,
                          cover_url: game.cover_url,
                          status: status,
                          detail: detail
                      }
                  }));
              }
              
              // E. Update PlayerStats JSONB Lists (Sync Service)
              if (status === 'Beat' || status === 'Completed') {
                  tasks.push(PlayerStatsService.syncBeatenGame(user.id, {
                      id: String(game.id),
                      title: title, // Use current form title
                      cover: game.cover_url || '',
                      score: game.final_score || 0
                  }));
              }
              
              if (status === 'Completed') {
                  tasks.push(PlayerStatsService.syncCompletedGame(user.id, {
                      id: String(game.id),
                      title: title,
                      cover: game.cover_url || '',
                      achievements: '100%' // Basic completion flag
                  }));
              }

              await Promise.all(tasks);
          }
      } catch (err) {
          console.error('[EditGameModal] Background sync failed:', err);
      }
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Game Details">
      <div className="space-y-6">
        
        {/* Row 1: Title & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider">Game Title</label>
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider">Status</label>
                <select
                    id="edit-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                >
                    <option value="Backlog">📂 Backlog</option>
                    <option value="Playing">▶️ Playing</option>
                    <option value="Beat">🏁 Beat (Main Story)</option>
                    <option value="Completed">🏆 Completed (100%)</option>
                    <option value="Dropped">🛑 Dropped</option>
                    <option value="Shelved">⏸️ Shelved</option>
                    <option value="Endless">♾️ Endless</option>
                </select>
            </div>
        </div>

        {/* Row 2: Executable */}
        <div id="edit-link-section" className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
            <FileCode size={12} /> Linked Executable
          </label>
          <div className="flex gap-2">
            <input 
              name="executable_path"
              type="text" 
              value={executable || ''}
              readOnly
              placeholder="No executable linked"
              className="flex-1 bg-muted/20 border border-border rounded-lg p-2.5 text-xs text-muted-foreground cursor-not-allowed outline-none font-mono"
            />
            <button 
              onClick={handleLinkExecutable}
              className="px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-border/50"
              title="Select .exe file"
            >
              <FolderOpen size={16} />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground pl-1">
            Link the game's <code>.exe</code> file to enable auto-tracking features.
          </p>
        </div>

        {/* Row 3: Platform Ownership Manager */}
        <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
                <Gamepad2 size={12} /> Managed Platforms
            </label>
            
            <div id="edit-platforms-section" className="bg-muted/30 border border-border rounded-xl overflow-hidden">
                {/* List Header */}
                {ownedPlatforms.length > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-4">Platform</div>
                        <div className="col-span-4 text-right">Date</div>
                        <div className="col-span-2 text-right">Cost</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>
                )}

                {/* List Items */}
                <div className="divide-y divide-border/50">
                    {ownedPlatforms.length > 0 ? ownedPlatforms.map(p => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm hover:bg-muted/20 transition-colors">
                            <div className="col-span-4 font-bold truncate" title={getPlatformName(p.id)}>
                                {getPlatformName(p.id)}
                            </div>
                            <div className="col-span-4 text-right">
                                <input
                                    type="date"
                                    value={formatTimestampForInput(p.acquired_at)}
                                    onChange={(e) => updatePlatformDate(p.id, e.target.value)}
                                    className="bg-transparent text-xs text-muted-foreground font-mono text-right border-none focus:ring-0 w-full p-0 cursor-pointer hover:text-foreground transition-colors"
                                    title="Acquisition Date"
                                />
                            </div>
                            <div className="col-span-2 text-right font-mono text-xs">
                                ${p.acquired_price.toFixed(2)}
                            </div>
                            <div className="col-span-2 flex justify-end gap-1">
                                <button 
                                    onClick={() => handleEditPlatform(p.id)}
                                    className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                                    title="Edit"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button 
                                    onClick={() => handleRemovePlatform(p.id)}
                                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                    title="Remove"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-6 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-2">
                            <AlertCircle size={16} className="opacity-50" />
                            No platforms associated. Add one below.
                        </div>
                    )}
                </div>

                {/* Add Control Footer (Grid Layout) */}
                <div className="p-4 bg-muted/40 border-t border-border/50 space-y-3">
                    <div className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
                        <Plus size={12} /> Add Platform
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Platform Select */}
                        <div className="md:col-span-2">
                            <select
                                value={platformToAdd}
                                onChange={(e) => setPlatformToAdd(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                            >
                                <option value="">Select Platform...</option>
                                {availableToAdd.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                                {platformToAdd && !availableToAdd.find(p => String(p.id) === platformToAdd) && (
                                     <option value={platformToAdd}>{getPlatformName(Number(platformToAdd))}</option>
                                )}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground z-10 pointer-events-none">
                                <Calendar size={12} />
                             </span>
                             <input 
                                type="date"
                                value={dateToAdd}
                                onChange={(e) => setDateToAdd(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg py-2.5 pl-8 pr-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>

                        {/* Price */}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={priceToAdd}
                                onChange={(e) => setPriceToAdd(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-background border border-border rounded-lg py-2.5 pl-7 pr-3 text-xs font-mono font-bold focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        
                        {/* Add Button */}
                        <div className="md:col-span-2">
                             <button
                                onClick={handleAddPlatform}
                                disabled={!platformToAdd}
                                className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold rounded-lg disabled:opacity-50 transition-colors border border-border/50 flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Plus size={14} /> Add Platform to Library
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Row 4: Legacy Playtime Section */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
            <Clock size={12} /> Historical Playtime
          </label>
          
          <div id="edit-legacy-input" className="bg-muted/30 border border-border rounded-xl overflow-hidden">
              {/* List Header */}
              {legacyEntries.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-7">Source</div>
                        <div className="col-span-3 text-right">Duration</div>
                        <div className="col-span-2 text-right">Action</div>
                  </div>
              )}

              {/* List Items */}
              <div className="divide-y divide-border/50">
                  {legacyEntries.length > 0 ? legacyEntries.map((entry, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm hover:bg-muted/20 transition-colors">
                          <div className="col-span-7">
                              <div className="font-bold truncate">{entry.source}</div>
                              {entry.platform_id && <div className="text-[9px] text-muted-foreground font-mono">ID: {entry.platform_id}</div>}
                          </div>
                          <div className="col-span-3 text-right font-mono text-xs">
                              {formatLegacyTime(entry.seconds)}
                          </div>
                          <div className="col-span-2 flex justify-end gap-1">
                              <button 
                                onClick={() => handleEditEntry(idx)} 
                                className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                                title="Edit"
                              >
                                  <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => handleRemoveEntry(idx)} 
                                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                title="Remove"
                              >
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </div>
                  )) : (
                    <div className="p-4 text-center text-xs text-muted-foreground italic">
                        No historical playtime recorded.
                    </div>
                  )}
              </div>

              {/* Add Controls */}
              <div className="bg-muted/40 border-t border-border/50 p-3 flex gap-2 items-center">
                 <select 
                    value={newSource} 
                    onChange={(e) => setNewSource(e.target.value)}
                    className="flex-1 bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                 >
                    {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
                 <div className="flex items-center gap-1 shrink-0">
                    <input 
                        type="number" min="0" placeholder="0" 
                        value={newHours} onChange={(e) => setNewHours(e.target.value)}
                        className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none focus:border-primary/50"
                    />
                    <span className="text-[10px] text-muted-foreground font-bold">H</span>
                 </div>
                 <div className="flex items-center gap-1 shrink-0">
                    <input 
                        type="number" min="0" max="59" placeholder="0" 
                        value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)}
                        className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none focus:border-primary/50"
                    />
                    <span className="text-[10px] text-muted-foreground font-bold">M</span>
                 </div>
                 <div className="flex items-center gap-1 shrink-0">
                    <input 
                        type="number" min="0" max="59" placeholder="0" 
                        value={newSeconds} onChange={(e) => setNewSeconds(e.target.value)}
                        className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none focus:border-primary/50"
                    />
                    <span className="text-[10px] text-muted-foreground font-bold">S</span>
                 </div>
                 <button 
                    onClick={handleAddEntry}
                    disabled={!newHours && !newMinutes && !newSeconds}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors border border-border/50 disabled:opacity-50"
                 >
                    <Plus size={16} />
                 </button>
              </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex justify-end pt-4 border-t border-border/50">
          <button 
            id="edit-modal-save"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </Modal>
  );
}