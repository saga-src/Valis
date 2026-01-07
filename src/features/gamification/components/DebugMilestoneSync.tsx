
import React, { useState } from 'react';
import { useGamification } from '../hooks/useGamification';
import { PlayerStatsService } from '../../social/services/PlayerStatsService';
import { PROGRESSION_TREE } from '../logic/milestones';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export const DebugMilestoneSync = () => {
    const { metrics } = useGamification();
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    const handleForceSync = async () => {
        if (!user) {
            setLog(prev => [...prev, "Error: No user logged in. Connect to cloud first."]);
            return;
        }

        setIsSyncing(true);
        setLog(["Starting Sync..."]);

        try {
            let syncCount = 0;

            for (const archetype of PROGRESSION_TREE) {
                for (const discipline of archetype.disciplines) {
                    // Get current value for this discipline's metric (e.g. 'total_games')
                    const currentValue = metrics[discipline.metric] || 0;
                    
                    // Iterate through tiers to find the highest unlocked rank
                    // We sync every achieved tier to ensure data integrity
                    for (const tier of discipline.tiers) {
                        if (currentValue >= tier.target) {
                            
                            const payload = {
                                key: discipline.id,       // e.g. "collector"
                                label: discipline.name,   // e.g. "The Collector"
                                rank: tier.level,         // e.g. 1
                                archetype: archetype.id   // e.g. "archivist"
                            };

                            await PlayerStatsService.updateMilestone(user.id, payload);
                            syncCount++;
                            
                            setLog(prev => [
                                `[${archetype.id}] Synced: ${discipline.name} (Rank ${tier.level})`,
                                ...prev
                            ]);

                            // Small delay to be polite to the DB
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }
                }
            }
            setLog(prev => [`Sync Complete! Processed ${syncCount} records.`, ...prev]);
        } catch (error: any) {
            setLog(prev => [`Error: ${error.message}`, ...prev]);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-4 border border-purple-500/30 rounded-xl bg-purple-500/5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-sm text-purple-400">Debug: Force Milestone Sync</h3>
                    <p className="text-xs text-muted-foreground">Push all locally unlocked tiers to Cloud DB.</p>
                </div>
                <button
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                >
                    {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {isSyncing ? 'Syncing...' : 'Run Sync'}
                </button>
            </div>
            
            {log.length > 0 && (
                <div className="h-48 overflow-y-auto p-3 bg-black/40 rounded-lg font-mono text-[10px] text-zinc-400 border border-white/5 space-y-1 custom-scrollbar">
                    {log.map((entry, i) => (
                        <div key={i} className="truncate">{entry}</div>
                    ))}
                </div>
            )}
        </div>
    );
};
