
import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';
import { openFileDialog } from '../../../lib/storage';
import { Save, FolderOpen, FileCode, Clock, Plus, Trash2, Pencil, Gamepad2, AlertCircle, Calendar, Tag as TagIcon, X } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils/cn';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/cloud/supabase';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';
import { Tag } from '../../../types';
import { useLibraryStore } from '../../../store/libraryStore';

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
  acquired_price: number;
  acquired_at?: number; 
}

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

const MAX_HISTORICAL_HOURS = 999999;

const parseHistoricalPart = (value: string, maximum: number) => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > maximum
  ) {
    return null;
  }
  return parsed;
};

const parseHistoricalDuration = (
  hours: string,
  minutes: string,
  seconds: string,
) => {
  const parsedHours = parseHistoricalPart(hours, MAX_HISTORICAL_HOURS);
  const parsedMinutes = parseHistoricalPart(minutes, 59);
  const parsedSeconds = parseHistoricalPart(seconds, 59);

  if (
    parsedHours === null ||
    parsedMinutes === null ||
    parsedSeconds === null
  ) {
    return null;
  }

  const totalSeconds =
    (parsedHours * 3600) + (parsedMinutes * 60) + parsedSeconds;
  return Number.isSafeInteger(totalSeconds) ? totalSeconds : null;
};

const formatHistoricalDuration = (totalSeconds: number) => {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

export default function EditGameModal({ isOpen, onClose, game, onSave, onSaveSuccess }: EditGameModalProps) {
  const { toast } = useToast();
  const { broadcastStatusChange } = useSocialBroadcast();
  const { user } = useAuth();
  const invalidateCache = useLibraryStore(state => state.invalidateCache);

  const [title, setTitle] = useState(game?.title || '');
  const [status, setStatus] = useState(game?.status || 'Backlog');
  const [executable, setExecutable] = useState(game?.executable || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // ⚡ Tag State
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);

  const parsePlatformData = (raw: any[]): OwnedPlatform[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((p: any) => ({
        id: Number(p.platform_id ?? p.id),
        acquired_price: Number(p.acquired_price ?? p.price ?? 0),
        acquired_at: p.acquired_at ? Number(p.acquired_at) : undefined
    }));
  };

  const [ownedPlatforms, setOwnedPlatforms] = useState<OwnedPlatform[]>(() => {
    try {
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
  const [dateToAdd, setDateToAdd] = useState<string>('');

  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>(() => {
    if (!game?.legacy_playtime_seconds) return [];
    if (Array.isArray(game.legacy_playtime_seconds)) return game.legacy_playtime_seconds;
    if (typeof game.legacy_playtime_seconds === 'number') {
        return [{ source: 'Manual', platform_id: null, seconds: game.legacy_playtime_seconds }];
    }
    return [];
  });

  const [newSource, setNewSource] = useState('Manual');
  const [newHours, setNewHours] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [newSeconds, setNewSeconds] = useState('');
  const [legacyInputError, setLegacyInputError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        setTitle(game?.title || '');
        setStatus(game?.status || 'Backlog');
        setExecutable(game?.executable || '');
        
        // Reset Tags
        setSelectedTags(game?.tags || []);
        
        // Fetch All Available Tags
        if (window.api?.getTags) {
            window.api.getTags().then(setAvailableTags);
        }

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
        
        if (Array.isArray(game.legacy_playtime_seconds)) setLegacyEntries(game.legacy_playtime_seconds);
        else if (typeof game.legacy_playtime_seconds === 'number') setLegacyEntries([{ source: 'Manual', platform_id: null, seconds: game.legacy_playtime_seconds }]);
        else setLegacyEntries([]);
        
        setNewHours('');
        setNewMinutes('');
        setNewSeconds('');
        setLegacyInputError(null);
        setNewSource('Manual');
        setPlatformToAdd('');
        setPriceToAdd('');
        setDateToAdd(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, game]);

  const safeParse = (json: any) => {
    try { return typeof json === 'string' ? JSON.parse(json) : json || []; } catch { return []; }
  };

  const getPlatformName = (id: number) => {
    if (STATIC_PLATFORM_NAMES[id]) return STATIC_PLATFORM_NAMES[id];
    const platforms = safeParse(game?.platforms);
    const match = platforms.find((p: any) => p.id === id);
    return match?.name || match?.abbreviation || `ID: ${id}`;
  };

  const formatTimestampForInput = (ts: number | undefined) => {
    if (!ts) return '';
    try {
        return new Date(ts).toISOString().split('T')[0];
    } catch { return ''; }
  };

  const platformOptions = useMemo(() => {
    const ownedNames = ownedPlatforms.map(p => getPlatformName(p.id));
    const existingSources = legacyEntries.map(e => e.source);
    const unique = new Set(['Manual', ...ownedNames, ...existingSources]);
    return Array.from(unique);
  }, [ownedPlatforms, legacyEntries]);

  const availableToAdd = useMemo(() => {
    const rawPlatforms = safeParse(game?.platforms);
    const options: { id: number; name: string }[] = [];
    rawPlatforms.forEach((p: any) => {
        if (p.id !== 6) options.push({ id: p.id, name: p.name || p.abbreviation || `ID: ${p.id}` });
    });
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
    options.push({ id: 99999, name: 'Unofficial Copy' }, { id: 100000, name: 'SteamTools' });
    return options.filter(p => !ownedPlatforms.some(op => op.id === p.id));
  }, [game, ownedPlatforms]);

  const pendingHistoricalSeconds = useMemo(
    () => parseHistoricalDuration(newHours, newMinutes, newSeconds),
    [newHours, newMinutes, newSeconds],
  );

  const canAddHistoricalEntry =
    pendingHistoricalSeconds !== null &&
    pendingHistoricalSeconds > 0 &&
    newSource.trim().length > 0;

  // --- Tag Management ---
  const filteredTagSuggestions = useMemo(() => {
    const input = tagInputValue.trim().toLowerCase();
    if (!input) return [];
    return availableTags.filter(t => 
      t.name.toLowerCase().includes(input) && 
      !selectedTags.some(st => st.id === t.id)
    );
  }, [tagInputValue, availableTags, selectedTags]);

  const handleAddTag = (tag: Tag) => {
    if (!selectedTags.some(st => st.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagInputValue('');
    setIsTagsDropdownOpen(false);
  };

  const handleCreateAndAddTag = async () => {
    const name = tagInputValue.trim();
    if (!name) return;

    const existing = availableTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      handleAddTag(existing);
      return;
    }

    if (!window.api?.createTag) return;
    const res = await window.api.createTag(name, '#7c3aed');
    if (res.success) {
      const newTag: Tag = { id: res.id, name, color: '#7c3aed' };
      setAvailableTags([...availableTags, newTag]);
      setSelectedTags([...selectedTags, newTag]);
      setTagInputValue('');
      setIsTagsDropdownOpen(false);
    }
  };

  const handleRemoveTag = (id: number) => {
    setSelectedTags(prev => prev.filter(t => t.id !== id));
  };

  const handleAddPlatform = () => {
    const id = Number(platformToAdd);
    if (!id || ownedPlatforms.some(p => p.id === id)) return;
    const price = parseFloat(priceToAdd) || 0;
    const date = dateToAdd ? new Date(dateToAdd).getTime() : Date.now();
    setOwnedPlatforms([...ownedPlatforms, { id, acquired_price: price, acquired_at: date }]);
    setPlatformToAdd('');
    setPriceToAdd('');
  };

  const handleRemovePlatform = (id: number) => {
    setOwnedPlatforms(prev => prev.filter(p => p.id !== id));
  };

  const handleAddEntry = () => {
    const totalSeconds = parseHistoricalDuration(
      newHours,
      newMinutes,
      newSeconds,
    );
    if (totalSeconds === null) {
      setLegacyInputError(
        `Use whole, non-negative values: H up to ${MAX_HISTORICAL_HOURS}, M and S from 0 to 59.`,
      );
      return;
    }
    if (totalSeconds <= 0) {
      setLegacyInputError('Historical playtime must be greater than zero.');
      return;
    }

    const normalizedSource = newSource.trim();
    if (!normalizedSource) {
      setLegacyInputError('Choose a source for this historical playtime.');
      return;
    }

    const existingIndex = legacyEntries.findIndex(e => e.source?.toLowerCase().trim() === normalizedSource.toLowerCase());
    if (existingIndex !== -1) {
        const updatedEntries = [...legacyEntries];
        updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], seconds: totalSeconds };
        setLegacyEntries(updatedEntries);
    } else {
        setLegacyEntries([...legacyEntries, { source: normalizedSource, platform_id: null, seconds: totalSeconds }]);
    }
    setNewHours(''); setNewMinutes(''); setNewSeconds(''); setNewSource('Manual');
    setLegacyInputError(null);
  };

  const handleLinkExecutable = async () => {
    const fullPath = await openFileDialog();
    if (fullPath) setExecutable(fullPath);
  };

  const handleSave = async () => {
    const finalExecutable = (executable && executable.trim().length > 0) ? executable : null;

    const updated = {
      ...game,
      title,
      status,
      skip_achievement_scan: true,
      executable: finalExecutable,
      legacy_playtime_seconds: legacyEntries,
      platform_ownership: ownedPlatforms.map(p => ({
          id: p.id,
          platform_id: p.id,
          acquired_price: p.acquired_price,
          acquired_at: p.acquired_at
      }))
    };

    setIsSaving(true);
    try {
        // Broadcast status change if it actually changed
        // This is the definitive place for manual status change broadcasting
        if (game.status !== status) {
            broadcastStatusChange(
                game.title || game.name,
                game.status,
                status,
                game.cover_url || game.cover?.url
            );
        }

        await onSave(updated);
        
        // Persist Normalized Tags
        if (window.api?.setGameTags) {
          await window.api.setGameTags(game.id, selectedTags.map(t => t.id));
        }

        // ⚡ Force Cache Invalidation to refresh Library grid
        invalidateCache();

        if (onSaveSuccess) onSaveSuccess();
        toast.success("Game details updated");
        onClose();
    } catch (e: any) {
        console.error(e);
        toast.error("Failed to save changes");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Game Details">
      <div className="space-y-6">
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
            <div className="space-y-1.5" id="edit-status-select">
                <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider">Status</label>
                <select
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

        {/* ⚡ NEW: TAG MANAGEMENT SECTION */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
            <TagIcon size={12} /> Tags
          </label>
          <div className="relative">
            <div className="flex flex-wrap gap-2 p-2 bg-background/50 border border-border rounded-lg min-h-[46px] focus-within:ring-1 focus-within:ring-primary transition-all">
              {selectedTags.map(tag => (
                <span 
                  key={tag.id} 
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 border border-primary/20 text-xs font-bold text-primary animate-in zoom-in-95 duration-200"
                >
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)} className="hover:text-primary-foreground hover:bg-primary rounded transition-colors">
                    <X size={12} strokeWidth={3} />
                  </button>
                </span>
              ))}
              <input 
                type="text"
                value={tagInputValue}
                onChange={(e) => {
                  setTagInputValue(e.target.value);
                  setIsTagsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredTagSuggestions.length > 0) handleAddTag(filteredTagSuggestions[0]);
                    else handleCreateAndAddTag();
                  }
                  if (e.key === 'Escape') setIsTagsDropdownOpen(false);
                }}
                onFocus={() => setIsTagsDropdownOpen(true)}
                placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
                className="flex-1 bg-transparent outline-none text-sm min-w-[100px] placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Suggestions Dropdown */}
            {isTagsDropdownOpen && (tagInputValue.trim() !== '') && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {filteredTagSuggestions.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 group"
                    >
                      <TagIcon size={14} className="text-muted-foreground group-hover:text-primary" />
                      <span className="font-medium">{tag.name}</span>
                    </button>
                  ))}
                  
                  {/* Create New Option */}
                  {!availableTags.some(t => t.name.toLowerCase() === tagInputValue.trim().toLowerCase()) && (
                    <button
                      onClick={handleCreateAndAddTag}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/10 border-t border-border transition-colors flex items-center gap-2 text-primary font-bold"
                    >
                      <Plus size={16} />
                      Create "{tagInputValue.trim()}"
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Click outside closer for dropdown */}
            {isTagsDropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsTagsDropdownOpen(false)} />
            )}
          </div>
        </div>

        <div className="space-y-1.5" id="edit-link-section">
          <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
            <FileCode size={12} /> Linked Executable
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={executable || ''}
              readOnly
              placeholder="No executable linked"
              className="flex-1 bg-muted/20 border border-border rounded-lg p-2.5 text-xs text-muted-foreground cursor-not-allowed outline-none font-mono truncate"
              title={executable || ""}
            />
            {executable && (
                <button 
                  type="button"
                  onClick={() => setExecutable('')}
                  className="px-3 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
            )}
            <button 
              type="button"
              onClick={handleLinkExecutable}
              className="px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-border/50"
            >
              <FolderOpen size={16} />
              <span>Browse...</span>
            </button>
          </div>
        </div>

        <div className="space-y-2" id="edit-platforms-section">
            <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
                <Gamepad2 size={12} /> Managed Platforms
            </label>
            <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
                {ownedPlatforms.length > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-4">Platform</div>
                        <div className="col-span-4 text-right">Date</div>
                        <div className="col-span-2 text-right">Cost</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>
                )}
                <div className="divide-y divide-border/50">
                    {ownedPlatforms.map(p => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm hover:bg-muted/20 transition-colors">
                            <div className="col-span-4 font-bold truncate">{getPlatformName(p.id)}</div>
                            <div className="col-span-4 text-right">
                                <input
                                    type="date"
                                    value={formatTimestampForInput(p.acquired_at)}
                                    onChange={(e) => {
                                      const ts = e.target.value ? new Date(e.target.value).getTime() : undefined;
                                      setOwnedPlatforms(prev => prev.map(op => op.id === p.id ? { ...op, acquired_at: ts } : op));
                                    }}
                                    className="bg-transparent text-xs text-muted-foreground font-mono text-right border-none focus:ring-0 w-full p-0 cursor-pointer hover:text-foreground"
                                />
                            </div>
                            <div className="col-span-2 text-right font-mono text-xs">${p.acquired_price.toFixed(2)}</div>
                            <div className="col-span-2 flex justify-end gap-1">
                                <button onClick={() => {
                                  setPlatformToAdd(String(p.id)); setPriceToAdd(String(p.acquired_price));
                                  if (p.acquired_at) setDateToAdd(new Date(p.acquired_at).toISOString().split('T')[0]);
                                  handleRemovePlatform(p.id);
                                }} className="text-muted-foreground hover:text-primary p-1.5 rounded-md transition-colors"><Pencil size={14} /></button>
                                <button onClick={() => handleRemovePlatform(p.id)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    {ownedPlatforms.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground italic">No platforms associated.</div>}
                </div>
                <div className="p-4 bg-muted/40 border-t border-border/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <select value={platformToAdd} onChange={(e) => setPlatformToAdd(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none cursor-pointer">
                                <option value="">Select Platform...</option>
                                {availableToAdd.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <input type="date" value={dateToAdd} onChange={(e) => setDateToAdd(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-xs font-medium focus:ring-1 focus:ring-primary outline-none" />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <input type="number" min="0" step="0.01" value={priceToAdd} onChange={(e) => setPriceToAdd(e.target.value)} placeholder="0.00" className="w-full bg-background border border-border rounded-lg py-2.5 pl-7 pr-3 text-xs font-mono font-bold focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                        <div className="md:col-span-2">
                             <button onClick={handleAddPlatform} disabled={!platformToAdd} className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold rounded-lg disabled:opacity-50 transition-colors border border-border/50">Add Platform</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-2" id="edit-legacy-input">
          <label className="text-[10px] font-bold uppercase text-primary/80 tracking-wider flex items-center gap-1.5">
            <Clock size={12} /> Historical Playtime
          </label>
          <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
              {legacyEntries.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-7">Source</div>
                        <div className="col-span-3 text-right">Duration</div>
                        <div className="col-span-2 text-right">Action</div>
                  </div>
              )}
              <div className="divide-y divide-border/50">
                  {legacyEntries.map((entry, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-4 px-4 py-2 items-center text-sm hover:bg-muted/20 transition-colors">
                          <div className="col-span-7 font-bold truncate">{entry.source}</div>
                           <div className="col-span-3 text-right font-mono text-xs">{formatHistoricalDuration(entry.seconds)}</div>
                          <div className="col-span-2 flex justify-end gap-1">
                              <button onClick={() => {
                                  setNewSource(entry.source);
                                  setNewHours(String(Math.floor(entry.seconds / 3600)));
                                   setNewMinutes(String(Math.floor((entry.seconds % 3600) / 60)));
                                   setNewSeconds(String(entry.seconds % 60));
                                   setLegacyInputError(null);
                                   handleRemoveLegacyEntry(idx);
                              }} className="text-muted-foreground hover:text-primary p-1.5 rounded-md transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => handleRemoveLegacyEntry(idx)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md transition-colors"><Trash2 size={14} /></button>
                          </div>
                      </div>
                  ))}
                  {legacyEntries.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground italic">No historical playtime.</div>}
              </div>
               <div className="bg-muted/40 border-t border-border/50 p-3">
                <div className="flex gap-2 items-center">
                  <select value={newSource} onChange={(e) => {
                    setNewSource(e.target.value);
                    setLegacyInputError(null);
                  }} className="flex-1 bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary">
                     {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <input type="number" min="0" max={MAX_HISTORICAL_HOURS} step="1" placeholder="H" aria-label="Historical playtime hours" value={newHours} onChange={(e) => {
                    setNewHours(e.target.value);
                    setLegacyInputError(null);
                  }} className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none" />
                  <input type="number" min="0" max="59" step="1" placeholder="M" aria-label="Historical playtime minutes" value={newMinutes} onChange={(e) => {
                    setNewMinutes(e.target.value);
                    setLegacyInputError(null);
                  }} className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none" />
                  <input type="number" min="0" max="59" step="1" placeholder="S" aria-label="Historical playtime seconds" value={newSeconds} onChange={(e) => {
                    setNewSeconds(e.target.value);
                    setLegacyInputError(null);
                  }} className="w-12 bg-background border border-border/50 rounded-lg px-1 py-1.5 text-xs text-center outline-none" />
                  <button onClick={handleAddEntry} disabled={!canAddHistoricalEntry} title="Add historical playtime" aria-label="Add historical playtime" className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors border border-border/50 disabled:opacity-40"><Plus size={16} /></button>
                </div>
                {legacyInputError && (
                  <p className="mt-2 text-[10px] text-red-500 font-medium" role="alert">
                    {legacyInputError}
                  </p>
                )}
               </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border/50">
          <button 
            id="edit-modal-save"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
          >
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );

  function handleRemoveLegacyEntry(index: number) {
    setLegacyEntries(prev => prev.filter((_, i) => i !== index));
  }
}
