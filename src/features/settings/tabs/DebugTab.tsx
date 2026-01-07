import React from 'react';
import { DebugMilestoneSync } from '../../gamification/components/DebugMilestoneSync';
import { AlertTriangle, Terminal } from 'lucide-react';
import { saveSetting } from '../../../lib/storage';

export const DebugTab = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-bold text-red-500 flex items-center gap-2">
          <Terminal size={24} /> Debug Console
        </h2>
        <p className="text-muted-foreground">Advanced utilities for developer testing and data troubleshooting. <span className="font-bold text-red-400">Use with caution.</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Milestone Sync Tool */}
          <div className="space-y-2">
             <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                <AlertTriangle size={12} className="text-yellow-500" /> Gamification Integrity
             </label>
             <DebugMilestoneSync />
          </div>
      </div>

      <div className="mt-12 p-6 border border-red-500/20 bg-red-500/10 rounded-xl space-y-4">
        <div>
          <h3 className="text-red-400 font-black text-sm uppercase tracking-widest">⚠️ Developer Zone</h3>
          <p className="text-xs text-muted-foreground mt-1">Manual overrides for system onboarding states.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* 1. RESET ALL (Nuclear Option) */}
          <button
            onClick={async () => {
              if (window.api && window.api.saveSetting) {
                await saveSetting('tour_setup_completed', false);
                await saveSetting('tour_walkthrough_completed', false);
                await saveSetting('onboarding_completed', false);
                window.location.reload();
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-red-900/20"
          >
            RESET ALL
          </button>

          {/* 2. RESET SETUP ONLY (Tour 1) */}
          <button
            onClick={async () => {
              if (window.api && window.api.saveSetting) {
                await saveSetting('tour_setup_completed', false);
                window.location.reload();
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-orange-900/20"
          >
            RESET SETUP (TOUR 1)
          </button>

          {/* 3. RESET WALKTHROUGH ONLY (Tour 2) */}
          <button
            onClick={async () => {
              if (window.api && window.api.saveSetting) {
                await saveSetting('tour_walkthrough_completed', false);
                // Ensure setup is marked true so we don't accidentally trigger Tour 1
                await saveSetting('tour_setup_completed', true);
                window.location.reload();
              }
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-yellow-900/20"
          >
            RESET WALKTHROUGH (TOUR 2)
          </button>
        </div>
        
        <p className="text-[10px] text-muted-foreground italic border-t border-red-500/10 pt-3">
          Note: Actioning any of these will force an immediate application reload.
        </p>
      </div>
    </div>
  );
};