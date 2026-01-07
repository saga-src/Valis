
import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Clock, BookOpen, ChevronDown, ChevronUp, Trophy, Plus, Pencil, AlertTriangle } from 'lucide-react';
import { formatDuration } from '../../../lib/utils/format';
import { cn } from '../../../lib/utils/cn';
import { SessionEditorModal } from '../../session-tracker/SessionEditorModal';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import { useToast } from '../../../context/ToastContext';
import { PlatformIcon } from '../../../components/ui/PlatformIcon';
import { CUSTOM_PLATFORM_DATA, CUSTOM_PLATFORMS } from '../../../types/index';

interface SessionsTabProps {
  game: any;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({ game }) => {
  const { toast } = useToast();
  const gameId = game.id;
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  
  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await window.api.getGameSessions(gameId);
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [gameId]);

  // --- DERIVED DATA ---

  // 1. Available Platforms (Derived from Game Prop)
  // Uses owned_platform_ids (Local DB) mapped to Names
  const availablePlatforms = useMemo(() => {
    let ownedIds: number[] = [];
    try {
        // Try platform_ownership object first (richer data)
        if (game.platform_ownership) {
             const ownership = typeof game.platform_ownership === 'string' 
                ? JSON.parse(game.platform_ownership) 
                : game.platform_ownership;
             ownedIds = ownership.map((o: any) => Number(o.id));
        } 
        // Fallback to simple ID list
        else if (game.owned_platform_ids) {
            const ids = typeof game.owned_platform_ids === 'string' 
                ? JSON.parse(game.owned_platform_ids) 
                : game.owned_platform_ids;
            ownedIds = (ids || []).map(Number);
        }
    } catch {}

    const metaPlatforms = typeof game.platforms === 'string' 
        ? JSON.parse(game.platforms || '[]') 
        : game.platforms || [];

    const options: { id: number; name: string }[] = [];

    ownedIds.forEach(id => {
        if (CUSTOM_PLATFORM_DATA[id]) {
            options.push(CUSTOM_PLATFORM_DATA[id]);
        } else {
            const meta = metaPlatforms.find((p: any) => p.id === id);
            options.push({ id, name: meta?.name || `Platform ${id}` });
        }
    });

    // Fallback if no platforms owned
    if (options.length === 0) {
        options.push(CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.UNOFFICIAL]);
    } else {
        // Ensure 'Other' options are available for flexibility
        if (!options.some(p => p.id === CUSTOM_PLATFORMS.UNOFFICIAL)) {
            options.push(CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.UNOFFICIAL]);
        }
    }

    // Deduplicate by ID
    const unique = new Map();
    options.forEach(p => unique.set(p.id, p));
    return Array.from(unique.values());

  }, [game]);

  // 2. Suggested Tags (from history)
  const suggestedTags = useMemo(() => {
    const all = sessions.flatMap(s => {
       if (Array.isArray(s.notes)) return s.notes;
       try { 
           const parsed = JSON.parse(s.notes);
           return Array.isArray(parsed) ? parsed : [];
       } catch { return []; }
    });
    return Array.from(new Set(all));
  }, [sessions]);

  // -----------------------------

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const handleAddSession = () => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  const handleEditSession = (session: any) => {
    // Map DB fields to Modal Props
    setEditingSession({
        id: session.id,
        startTime: new Date(session.start_time).getTime(),
        durationSeconds: session.duration_seconds || (session.duration_minutes * 60) || 0,
        platformId: session.platform_id,
        mood: session.mood,
        notes: session.notes,
        journal: session.journal_text
    });
    setIsModalOpen(true);
  };

  const handleSaveSession = async (data: any) => {
    try {
        const payload = {
            startTime: data.timestamp,
            durationSeconds: data.durationSeconds,
            platformId: data.platformId,
            mood: data.mood,
            notes: data.notes,
            journal: data.journal
        };

        if (editingSession) {
            await window.api.updateSession(editingSession.id, payload);
            toast.success("Session updated");
        } else {
            await window.api.addManualSession({
                gameId,
                ...payload
            });
            toast.success("Session added");
        }
        setIsModalOpen(false);
        loadSessions();
    } catch (e) {
        console.error(e);
        toast.error("Failed to save session");
    }
  };

  const handleDeleteClick = () => {
      // Trigger confirmation modal
      setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
      if (!editingSession) return;
      setIsDeleting(true);
      try {
          await window.api.deleteSession(editingSession.id);
          toast.success("Session deleted");
          setShowDeleteConfirm(false);
          setIsModalOpen(false); // Close the editor as well
          loadSessions();
      } catch(e) {
          console.error(e);
          toast.error("Failed to delete session");
      } finally {
          setIsDeleting(false);
      }
  };

  const formatTimeRange = (start: number, end: number | null) => {
    const startDate = new Date(start);
    const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!end) return startTimeStr; // Ongoing or unknown end
    
    const endDate = new Date(end);
    const endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `${startTimeStr} - ${endTimeStr}`;
  };

  // Helper to get platform name
  const getPlatformName = (pid?: number) => {
    if (!pid) return '';
    return CUSTOM_PLATFORM_DATA[pid]?.name || '';
  };

  if (loading) return <div className="p-4 text-center text-muted-foreground">Loading sessions...</div>;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">History</h3>
          <button 
            onClick={handleAddSession}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
          >
            <Plus size={14} /> Add Session
          </button>
      </div>

      {sessions.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            No sessions recorded yet. Play the game or add one manually!
        </div>
      ) : (
        <div className="space-y-3">
            {sessions.map((session) => {
                const hasJournal = session.journal_text && session.journal_text.trim().length > 0;
                const hasAchievements = session.achievements && session.achievements.length > 0;
                const canExpand = hasJournal || hasAchievements;
                const isExpanded = expandedIds.has(session.id);
                
                // Parse notes as tags if string
                let tags: string[] = [];
                if (Array.isArray(session.notes)) tags = session.notes;
                else if (typeof session.notes === 'string') {
                    try { tags = JSON.parse(session.notes); } catch { tags = []; }
                }

                return (
                <div 
                    key={session.id} 
                    className={cn(
                        "bg-card border rounded-xl shadow-sm transition-all overflow-hidden group",
                        canExpand ? "hover:border-primary/50 cursor-pointer" : ""
                    )}
                    onClick={() => canExpand && toggleExpand(session.id)}
                >
                    {/* Main Row */}
                    <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                        {/* Icon Container: Priority based (Achievements > Journal > Calendar) */}
                        <div className={cn("p-2 rounded-lg transition-colors flex items-center justify-center w-10 h-10 shrink-0 text-xl select-none", 
                            hasAchievements ? "bg-yellow-500/10 text-yellow-500" : 
                            hasJournal ? "bg-primary/10 text-primary" : 
                            "bg-muted text-muted-foreground"
                        )}>
                            {hasAchievements ? <Trophy size={20} /> : (hasJournal ? <BookOpen size={20} /> : <Calendar size={20} />)}
                        </div>
                        
                        <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                                {new Date(session.start_time).toLocaleDateString()}
                                {session.platform_id && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/50">
                                        <PlatformIcon platformId={session.platform_id} platformName={getPlatformName(session.platform_id)} size={10} />
                                        {getPlatformName(session.platform_id)}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span className="font-mono">
                                    {formatTimeRange(session.start_time, session.end_time)}
                                </span>
                                
                                {tags.length > 0 && (
                                    <>
                                        <span>•</span>
                                        <div className="flex gap-1">
                                            {tags.map((t, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-[4px] text-[10px]">{t}</span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        
                        {/* Edit Button (Hidden until group-hover) */}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation(); 
                                handleEditSession(session);
                            }}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                            title="Edit Session"
                        >
                            <Pencil size={16} />
                        </button>

                        {hasAchievements && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-600 bg-yellow-500/10 px-2.5 py-1 rounded-md border border-yellow-500/20">
                                <Trophy size={12} />
                                <span>{session.achievements.length}</span>
                            </div>
                        )}

                        <div className="text-right">
                            <div className="font-bold font-mono text-sm flex items-center gap-1 justify-end">
                                <Clock size={14} /> {formatDuration((session.duration_seconds || 0) * 1000)}
                            </div>
                        </div>
                        
                        {canExpand && (
                            <div className="text-muted-foreground">
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                        )}
                    </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 space-y-4">
                            {hasJournal && (
                                <div className="p-4 bg-muted/30 rounded-lg border-l-2 border-primary text-sm leading-relaxed whitespace-pre-wrap">
                                    {session.journal_text}
                                </div>
                            )}

                            {hasAchievements && (
                                <div className="bg-black/20 rounded-lg border border-white/5 p-3">
                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Trophy size={12} className="text-yellow-500" /> 
                                        Unlocked ({session.achievements.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {session.achievements.map((ach: any) => (
                                            <div key={ach.id} className="flex items-center gap-3 bg-background/50 hover:bg-background p-2 rounded-md border border-white/5 transition-colors">
                                                {ach.icon_url ? (
                                                    <img src={ach.icon_url} className="w-8 h-8 rounded object-cover bg-muted" alt="Icon" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                        <Trophy size={14} className="opacity-50" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{ach.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{ach.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                );
            })}
        </div>
      )}

      <SessionEditorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingSession}
        onSave={handleSaveSession}
        onDelete={editingSession ? handleDeleteClick : undefined}
        suggestedTags={suggestedTags}
        availablePlatforms={availablePlatforms}
        game={game}
        gameId={game.id}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Session?"
        message={
            <div className="flex items-start gap-3">
                <div className="p-2 bg-destructive/10 rounded-full text-destructive shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <p className="font-bold text-foreground">Are you sure?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        This action cannot be undone. The game's total playtime and session history will be permanently updated.
                    </p>
                </div>
            </div>
        }
        confirmText="Delete Forever"
        isDanger={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
