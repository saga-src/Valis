import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CRITICAL_PILLARS, 
  CASUAL_CRITERIA 
} from './constants';
import { SCORE_LABELS } from './labels';
import { useReviewCalculator } from './useReviewCalculator';
import { Save, Info, RefreshCw, Edit2, X } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useToast } from '../../context/ToastContext';
import { Games, System } from '../../lib/api';
import { useMarkObserver } from '../gamification/hooks/useMarkObserver';

// ⚡ SAFE LOGGING HELPER
const safeLog = (msg: string, data?: any) => {
    const fullMsg = `[ReviewEditor] ${msg} ${data ? JSON.stringify(data) : ''}`;
    System.log(fullMsg);
};

interface ReviewTabProps {
  game: any;
  onUpdate?: (updatedGame: any) => void;
}

export const ReviewEditor: React.FC<ReviewTabProps> = ({ game, onUpdate }) => {
  const { toast } = useToast();
  const renderCount = useRef(0);
  const { reportSignal } = useMarkObserver();
  
  // --- 1. SAFE GENRE PARSING (SQL JSON FORMAT) ---
  const { genreIds, genreDisplayNames } = useMemo(() => {
    renderCount.current++;
    safeLog(`Render #${renderCount.current}. Parsing Genres...`);
    
    let ids: string[] = [];
    let names: string[] = [];

    try {
        if (!game || !game.genres) {
            safeLog("No genres found on game object.");
            return { genreIds: [], genreDisplayNames: [] };
        }

        // Handle: Stringified JSON (SQL) OR Already Parsed Object
        let genresData = game.genres;
        if (typeof genresData === 'string') {
            try {
                // Check if empty or null string
                if (genresData.trim() === '' || genresData === 'null') {
                    genresData = [];
                } else {
                    genresData = JSON.parse(genresData);
                }
            } catch (jsonErr) {
                safeLog("JSON Parse Error for Genres", jsonErr);
                genresData = [];
            }
        }

        // Validate Array Structure
        if (Array.isArray(genresData)) {
            ids = genresData.map((g: any) => String(g?.id || '')); // Safely extract ID
            names = genresData.map((g: any) => String(g?.name || 'Unknown')); // Safely extract Name
            
            // Remove empty IDs
            ids = ids.filter(id => id !== '');
            safeLog("Genres Parsed Successfully:", { ids, names });
        } else {
            safeLog("Genres data is not an array", typeof genresData);
        }

    } catch (e) {
        safeLog("CRITICAL GENRE ERROR", e);
    }
    return { genreIds: ids, genreDisplayNames: names };
  }, [game]);

  // --- 2. METADATA PARSING ---
  const existingMetadata = useMemo(() => {
    try {
      if (!game.review_metadata) return {};
      
      const parsed = typeof game.review_metadata === 'string' 
        ? JSON.parse(game.review_metadata) 
        : game.review_metadata;

      // ⚡ CRITICAL FIX: JSON.parse("null") returns null, which crashes the app later.
      return parsed || {}; 

    } catch (e) {
      safeLog("Metadata parse error", e);
      return {};
    }
  }, [game.review_metadata]);

  // --- 3. STATE INIT ---
  const hasSavedReview = !!existingMetadata.method;
  const [isEditing, setIsEditing] = useState(!hasSavedReview);
  const defaultMethod = existingMetadata.method || 'CASUAL';
  const [method, setMethod] = useState<'CRITICAL' | 'CASUAL'>(defaultMethod);
  const [notes, setNotes] = useState<string>(existingMetadata.notes || '');
  
  const [scores, setScores] = useState<Record<string, number>>(() => {
    if (existingMetadata.criteria_scores) return existingMetadata.criteria_scores;
    const defaults: Record<string, number> = {};
    [...CASUAL_CRITERIA, ...CRITICAL_PILLARS].forEach(item => {
      defaults[item.id] = 4;
    });
    return defaults;
  });

  const [finalScore, setFinalScore] = useState<string>(
      game.final_score !== null && game.final_score !== undefined ? String(game.final_score) : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // --- 4. CALCULATOR ---
  const calculator = useReviewCalculator();
  const { calculateCriticalScore, calculateCasualScore } = calculator;

  const calculation = useMemo(() => {
    try {
        if (!calculator) throw new Error("Calculator hook failed");
        
        return method === 'CRITICAL' 
          ? calculateCriticalScore(genreIds, scores) 
          : calculateCasualScore(scores);
    } catch (e) {
        safeLog("Calculation Error", e);
        return { average: 0, label: 'Error', suggestedRange: '-' };
    }
  }, [method, genreIds, scores, calculateCriticalScore, calculateCasualScore]);

  // --- ACTIONS ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const metadata = {
        method,
        genre_ids: genreIds, 
        genre_display: genreDisplayNames.join(', '),
        criteria_scores: scores,
        calculated_average: calculation.average,
        suggested_range: calculation.suggestedRange,
        notes: notes
      };

      const updatedGame = {
        ...game,
        id: String(game.id),
        final_score: finalScore === '' ? null : parseFloat(finalScore),
        review_metadata: JSON.stringify(metadata)
      };

      await Games.update(updatedGame);
      
      if (onUpdate) onUpdate(updatedGame);
      setIsEditing(false);
      toast.success('Review saved!');
      
      // ⚡ Report Signal
      if (notes.length > 0) reportSignal('SAVE_JOURNAL', notes);

    } catch (e: any) {
      console.error(e);
      toast.error('Failed to save: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const items = method === 'CASUAL' ? CASUAL_CRITERIA : CRITICAL_PILLARS;
  const primaryGenreDisplay = genreDisplayNames.length > 0 ? genreDisplayNames.join(' + ') : 'Standard';

  const getLabel = (criteriaId: string, val: number) => {
    try {
        return SCORE_LABELS[criteriaId]?.[Math.round(val)] || '';
    } catch { return ''; }
  };

  // --- RENDER ---
  // View Mode
  if (!isEditing && hasSavedReview) {
      return (
          <div className="max-w-4xl mx-auto animate-in fade-in">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                          My Verdict 
                          <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full uppercase tracking-wider">
                              {method}
                          </span>
                      </h2>
                      <p className="text-muted-foreground text-sm mt-1">
                          Analyzed as <span className="font-medium text-foreground">{primaryGenreDisplay}</span>
                      </p>
                  </div>
                  <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors"
                  >
                      <Edit2 size={14} /> Edit Review
                  </button>
              </div>

              {/* Score Card */}
              <div className="bg-card border rounded-xl p-8 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-center md:text-left">
                      <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Final Score</div>
                      <div className="text-6xl font-black text-primary tracking-tighter">
                          {game.final_score || '-'}
                      </div>
                  </div>
                  <div className="h-16 w-px bg-border hidden md:block" />
                  <div className="text-center">
                      <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Calculated Math</div>
                      <div className="text-3xl font-bold text-foreground">
                          {calculation.average?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                          Suggestion: {calculation.suggestedRange}
                      </div>
                  </div>
                  <div className="h-16 w-px bg-border hidden md:block" />
                  <div className="text-center md:text-right">
                      <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Result</div>
                      <div className="text-xl font-bold text-foreground">
                          {calculation.label}
                      </div>
                  </div>
              </div>

              {/* Written Review Display */}
              {existingMetadata.notes && (
                  <div className="bg-card border rounded-xl p-6 mb-8 shadow-sm">
                      <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3">Review Notes</h3>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {existingMetadata.notes}
                      </p>
                  </div>
              )}

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors group relative">
                          <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm cursor-help">{item.label}</span>
                              {item.description && (
                                  <>
                                      <Info size={12} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                                          {item.description}
                                      </div>
                                  </>
                              )}
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                  {getLabel(item.id, scores[item.id] || 4)}
                              </span>
                              <span className={cn(
                                  "font-mono font-bold w-6 text-center",
                                  (scores[item.id] || 4) >= 6 ? "text-green-500" : (scores[item.id] || 4) <= 2 ? "text-red-500" : "text-foreground"
                              )}>
                                  {scores[item.id] || 4}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // Edit Mode
  return (
    <div className="max-w-3xl mx-auto pb-20 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex bg-muted p-1 rounded-lg">
                <button onClick={() => setMethod('CASUAL')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", method === 'CASUAL' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Casual</button>
                <button onClick={() => setMethod('CRITICAL')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", method === 'CRITICAL' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Critical</button>
          </div>
          {hasSavedReview && (
              <button onClick={() => setIsEditing(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X size={12} /> Cancel
              </button>
          )}
      </div>

      {/* Written Review Input */}
      <div className="bg-card border rounded-xl p-4 shadow-sm mb-6">
          <label className="text-sm font-bold text-muted-foreground uppercase mb-2 block">Review Notes</label>
          <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your thoughts here..."
              className="w-full min-h-[100px] bg-secondary/30 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-y"
          />
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6 mb-8">
            {items.map(item => {
                const value = scores[item.id] || 4;
                return (
                    <div key={item.id} className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-1.5 group relative">
                                <label className="text-sm font-medium cursor-help">{item.label}</label>
                                {item.description && (
                                    <>
                                        <Info size={12} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-relaxed">
                                            {item.description}
                                        </div>
                                    </>
                                )}
                            </div>
                            <span className="font-mono font-bold text-sm text-muted-foreground">{value}</span>
                        </div>
                        <input type="range" min="1" max="7" step="1" value={value} onChange={(e) => setScores(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) }))} className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
                        <div className="flex justify-center">
                            <span className="inline-block px-3 py-1 bg-secondary/50 rounded text-xs font-medium text-secondary-foreground">{getLabel(item.id, value)}</span>
                        </div>
                    </div>
                );
            })}
      </div>

      <div className="bg-card border rounded-xl shadow-lg sticky bottom-6 z-10 overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
                <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Calculated</div>
                    <div className="text-2xl font-black text-primary/80">{calculation.average?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Suggestion</div>
                    <div className="text-sm font-bold">{calculation.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{calculation.suggestedRange}</div>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex flex-col items-end">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Final Score</label>
                     <input type="number" min="0" max="10" step="0.5" value={finalScore} onChange={(e) => setFinalScore(e.target.value)} onBlur={() => { if (finalScore !== '') setFinalScore(String(Math.round(Math.min(10, Math.max(0, parseFloat(finalScore))) * 2) / 2)); }} placeholder="-" className="w-20 p-2 text-xl font-black text-center bg-muted/50 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <button onClick={handleSave} disabled={isSaving} className="h-12 px-6 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-sm">
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <><Save size={16} /> Save</>}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};