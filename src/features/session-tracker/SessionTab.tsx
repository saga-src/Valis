import { useEffect, useState } from 'react';
import { useSessionManager } from './useSessionManager';
import { formatDuration, formatSessionDate, formatPlaytime } from '../../lib/utils/format';
import { Platform, CUSTOM_PLATFORMS, CUSTOM_PLATFORM_DATA } from '../../types/index';
import { PlatformIcon } from '../../components/ui/PlatformIcon';

interface Session {
  id: string;
  game_id: string;
  platform_id?: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  duration_seconds?: number;
  mood: string;
  notes: string[];
  journal?: string;
}

interface SessionTabProps {
  gameId: string;
  gameTitle: string;
  ownedPlatformIds: number[];
  availablePlatforms: Platform[];
  sessions: any[];
}

export const SessionTab = ({ gameId, gameTitle, ownedPlatformIds, availablePlatforms, sessions }: SessionTabProps) => {
  const { 
    activeSession, elapsed, startTimer, stopTimer,
    draft, setDraftMood, setDraftPlatform, addDraftNote, removeDraftNote, setDraftJournal 
  } = useSessionManager();
  
  const [history, setHistory] = useState<Session[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Resolve Platforms
  const ownedPlatforms = ownedPlatformIds.map(id => {
    if (CUSTOM_PLATFORM_DATA[id]) return CUSTOM_PLATFORM_DATA[id];
    return availablePlatforms.find(p => p.id === id);
  }).filter(Boolean) as Platform[];

  // Set default platform for draft if only one exists and none selected
  useEffect(() => {
    if (!draft.platformId && ownedPlatforms.length > 0) {
       setDraftPlatform(ownedPlatforms[0].id);
    }
  }, [ownedPlatforms.length, draft.platformId, setDraftPlatform]);

  useEffect(() => {
    // Sort by newest first
    const sorted = [...sessions].sort((a: any, b: any) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
    setHistory(sorted);
    
    // Extract unique tags with safe parsing
    const tags = new Set<string>();
    sorted.forEach((s: any) => {
        let n: string[] = [];
        if (Array.isArray(s.notes)) {
            n = s.notes;
        } else if (typeof s.notes === 'string') {
            try { n = JSON.parse(s.notes); } catch {}
        }
        if (Array.isArray(n)) {
            n.forEach(tag => tags.add(tag));
        }
    });
    setSuggestedTags(Array.from(tags));
  }, [sessions]);

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !draft.notes.includes(tag.trim())) {
      addDraftNote(tag.trim());
    }
    setTagInput('');
  };

  const getPlatformName = (pid?: number) => {
    if (!pid) return '';
    if (CUSTOM_PLATFORM_DATA[pid]) return CUSTOM_PLATFORM_DATA[pid].name;
    const p = availablePlatforms.find(ap => ap.id === pid);
    return p?.abbreviation || p?.name || 'Unknown';
  };

  const getFullPlatformName = (pid?: number) => {
    if (!pid) return '';
    if (CUSTOM_PLATFORM_DATA[pid]) return CUSTOM_PLATFORM_DATA[pid].name;
    const p = availablePlatforms.find(ap => ap.id === pid);
    return p?.name || 'Unknown';
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* --- TOP SECTION: TIMER & FORM --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Stopwatch Control */}
        <div className="p-6 border rounded-xl bg-card shadow-sm flex flex-col items-center justify-center text-center">
           {activeSession?.gameId === String(gameId) ? (
             <>
               <div className="text-green-500 font-bold mb-2 animate-pulse">● Recording Session</div>
               {activeSession.platformId && (
                 <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                   on {getPlatformName(activeSession.platformId)}
                 </div>
               )}
               <div className="text-4xl font-mono font-bold my-4">
                 {formatDuration(elapsed)}
               </div>
               <button 
                 onClick={() => stopTimer()}
                 className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-bold hover:opacity-90 transition-all"
               >
                 Stop & Save
               </button>
             </>
           ) : activeSession ? (
             <div className="text-yellow-500 font-medium">
               Timer running for another game!
             </div>
           ) : (
             <>
               <div className="text-muted-foreground mb-4">Ready to play?</div>
               
               {/* Platform Selector (only if multiple owned) */}
               {ownedPlatforms.length > 0 && (
                 <div className="w-full mb-4 text-left">
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {ownedPlatforms.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setDraftPlatform(p.id)}
                          className={`px-3 py-1.5 text-xs rounded border flex items-center gap-1 transition-all ${
                            draft.platformId === p.id 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          <PlatformIcon platformId={p.id} platformName={p.name} />
                          {p.abbreviation || p.name}
                        </button>
                      ))}
                    </div>
                 </div>
               )}

               <button 
                 onClick={() => startTimer(String(gameId), gameTitle, undefined, draft.platformId)}
                 className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
                 disabled={ownedPlatforms.length > 0 && !draft.platformId}
               >
                 Start Session
               </button>
             </>
           )}
        </div>

        {/* Right: Session Details Form */}
        <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Session Details</h3>
            <select 
              value={draft.mood} 
              onChange={(e) => setDraftMood(e.target.value)}
              className="p-1 border rounded bg-background"
            >
              <option value="🤩">🤩 Amazing</option>
              <option value="🙂">🙂 Good</option>
              <option value="😐">😐 Average</option>
              <option value="😴">😴 Boring</option>
              <option value="😡">😡 Frustrating</option>
              <option value="😭">😭 Sad</option>
            </select>
          </div>

          {/* Tags */}
          <div>
             <div className="flex flex-wrap gap-2 mb-2">
               {draft.notes.map(note => (
                 <span key={note} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full flex items-center gap-1">
                   {note}
                   <button onClick={() => removeDraftNote(note)} className="hover:text-red-500 font-bold">×</button>
                 </span>
               ))}
             </div>
             <input 
               value={tagInput}
               onChange={e => setTagInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleAddTag(tagInput)}
               placeholder="Type tag & enter..."
               className="w-full p-2 text-sm border rounded bg-background"
             />
             {suggestedTags.length > 0 && (
               <div className="flex flex-wrap gap-1 mt-2">
                 {suggestedTags.slice(0, 5).map(tag => (
                   <button 
                     key={tag} 
                     onClick={() => handleAddTag(tag)}
                     className="text-[10px] px-2 py-0.5 border rounded-full hover:bg-muted"
                   >
                     + {tag}
                   </button>
                 ))}
               </div>
             )}
          </div>

          {/* Journal */}
          <textarea 
            value={draft.journal}
            onChange={e => setDraftJournal(e.target.value)}
            className="w-full p-2 text-sm border rounded h-20 bg-background resize-none"
            placeholder="Key moments, builds, or thoughts..."
          />
        </div>
      </div>

      {/* --- BOTTOM SECTION: HISTORY LIST --- */}
      <div>
        <h3 className="text-xl font-bold mb-4">Session History</h3>
        
        {history.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/20 text-muted-foreground">
            No sessions recorded yet. Go touch some grass... or play!
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 text-xs font-bold text-muted-foreground border-b">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">End Time</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-1 text-center">Mood</div>
              <div className="col-span-3">Tags</div>
            </div>

            {/* List Items */}
            {history.map(session => {
              // Parse notes safely for rendering
              let displayNotes: string[] = [];
              if (Array.isArray(session.notes)) {
                  displayNotes = session.notes;
              } else if (typeof session.notes === 'string') {
                  try { displayNotes = JSON.parse(session.notes); } catch { displayNotes = []; }
              }

              return (
                <div key={session.id} className="group border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <div 
                    className="grid grid-cols-12 gap-4 p-4 text-sm items-center cursor-pointer"
                    onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                  >
                    <div className="col-span-3 font-medium flex flex-col">
                      {formatSessionDate(session.start_time)}
                      {session.platform_id && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <PlatformIcon platformId={session.platform_id} platformName={getFullPlatformName(session.platform_id)} />
                            {getPlatformName(session.platform_id)}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-muted-foreground">
                      {formatSessionDate(session.end_time)}
                    </div>
                    <div className="col-span-2 font-mono text-xs bg-secondary/50 px-2 py-1 rounded w-fit">
                      {formatDuration(
                          session.duration_seconds 
                              ? session.duration_seconds * 1000 
                              : (session.duration_minutes || 0) * 60000
                      )}
                    </div>
                    <div className="col-span-1 text-center text-xl">
                      {session.mood}
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {displayNotes.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground">
                          {tag}
                        </span>
                      ))}
                      {displayNotes.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{displayNotes.length - 2}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Journal Details */}
                  {(expandedSessionId === session.id && session.journal) && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="p-3 bg-muted/30 rounded text-sm text-muted-foreground italic border-l-2 border-primary">
                        "{session.journal}"
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}