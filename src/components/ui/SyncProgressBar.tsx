
import React from 'react';
import { useSyncStore } from '../../store/syncStore';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

export const SyncProgressBar: React.FC = () => {
  const { isSyncing, message, progress } = useSyncStore();

  if (!isSyncing && progress === 0) return null;

  const isComplete = progress >= 100;

  return (
    <div className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md pointer-events-none transition-all duration-500",
        isSyncing ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
    )}>
      <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full shadow-2xl p-1.5 flex items-center gap-4 pr-4">
         <div className="relative shrink-0">
            {isComplete ? (
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white animate-in zoom-in">
                    <CheckCircle2 size={18} />
                </div>
            ) : (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                    <Loader2 size={16} className="animate-spin" />
                </div>
            )}
         </div>
         
         <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white truncate max-w-[200px]">{message || 'Processing...'}</span>
                <span className="text-[10px] font-mono text-zinc-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                />
            </div>
         </div>
      </div>
    </div>
  );
};
