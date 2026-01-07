
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Minus, Maximize2, CheckCircle2, Loader2 } from 'lucide-react';
import { useSyncStore } from '../../../store/syncStore';
import { cn } from '../../../lib/utils/cn';

export const SyncProgressToast: React.FC = () => {
  const { isSyncing, message, progress } = useSyncStore();
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Auto-expand on new sync start
  useEffect(() => {
    if (isSyncing && progress === 0) {
      setIsMinimized(false);
    }
  }, [isSyncing, progress]);

  // If not syncing and progress is reset, don't show anything
  if (!isSyncing && progress === 0) return null;

  const isComplete = progress >= 100;

  return (
    <AnimatePresence>
      {(isSyncing || progress > 0) && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            "fixed bottom-6 right-6 z-[200] bg-zinc-900/95 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden pointer-events-auto",
            isMinimized ? "rounded-full py-2 px-4 h-10" : "rounded-2xl p-4 w-80"
          )}
        >
          {isMinimized ? (
            <motion.div 
              layout="position"
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => setIsMinimized(false)}
            >
              {isComplete ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <RefreshCw size={14} className="animate-spin text-primary" />
              )}
              <span className="text-xs font-bold text-white whitespace-nowrap">
                {isComplete ? 'Sync Complete' : `Syncing... ${Math.round(progress)}%`}
              </span>
              <Maximize2 size={12} className="text-zinc-500 ml-1" />
            </motion.div>
          ) : (
            <motion.div layout="position" className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    isComplete ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                  )}>
                    {isComplete ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-white/90">Library Sync</h4>
                    <p className="text-[10px] font-medium text-zinc-500">{isComplete ? 'Success' : 'In Progress'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMinimized(true)} 
                  className="p-1 hover:bg-white/5 rounded-md text-zinc-500 hover:text-white transition-colors"
                >
                  <Minus size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[200px]">
                    {message || 'Synchronizing with cloud...'}
                  </span>
                  <span className="text-[10px] font-mono text-primary font-bold">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className={cn(
                      "h-full transition-all duration-300 ease-out",
                      isComplete ? "bg-emerald-500" : "bg-primary"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {isComplete && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-emerald-500/80 font-medium italic text-center animate-pulse"
                >
                  Vault data updated successfully.
                </motion.p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
