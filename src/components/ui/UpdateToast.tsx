import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, CheckCircle2, ArrowUpCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

export const UpdateToast = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!window.api) return;

    const unAvailable = window.api.onUpdateAvailable((info: any) => {
      setVersion(info.version);
      setStatus('available');
      setIsVisible(true);
    });

    const unProgress = window.api.onUpdateProgress((p: any) => {
      setStatus('downloading');
      setProgress(p.percent || 0);
    });

    const unDownloaded = window.api.onUpdateDownloaded((info: any) => {
      setVersion(info.version);
      setStatus('ready');
      setProgress(100);
      setIsVisible(true);
    });

    const unError = window.api.onUpdateError((err: string) => {
      console.error('[UpdateToast] Error:', err);
      // We don't necessarily show an error toast to avoid annoyance, 
      // but we reset status so it doesn't get stuck.
      setStatus('idle');
      setIsVisible(false);
    });

    return () => {
      unAvailable();
      unProgress();
      unDownloaded();
      unError();
    };
  }, []);

  const handleDownload = () => {
    if (window.api?.startDownload) {
      window.api.startDownload();
      setStatus('downloading');
    }
  };

  const handleRestart = () => {
    if (window.api?.quitAndInstall) {
      window.api.quitAndInstall();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // After animation, reset if not ready
    setTimeout(() => {
      if (status !== 'ready') setStatus('idle');
    }, 500);
  };

  if (!isVisible || status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        exit={{ opacity: 0, y: 20, scale: 0.95, x: 20 }}
        className={cn(
          "fixed bottom-6 right-6 z-[1000] w-80 bg-zinc-900/95 backdrop-blur-md border rounded-2xl shadow-2xl overflow-hidden p-4",
          status === 'ready' ? "border-emerald-500/50" : "border-white/10"
        )}
      >
        {/* Progress bar background */}
        {status === 'downloading' && (
          <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full">
            <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
            status === 'ready' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-primary/10 border-primary/20 text-primary"
          )}>
            {status === 'available' && <ArrowUpCircle size={24} />}
            {status === 'downloading' && <Loader2 size={24} className="animate-spin" />}
            {status === 'ready' && <CheckCircle2 size={24} />}
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-black uppercase tracking-tight text-white">
                {status === 'available' && "Update Available"}
                {status === 'downloading' && "Downloading..."}
                {status === 'ready' && "System Ready"}
              </h4>
              {status !== 'downloading' && (
                <button 
                  onClick={handleClose}
                  className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <p className="text-xs text-zinc-400 mt-1">
              {status === 'available' && `New version v${version} is ready for download.`}
              {status === 'downloading' && `Fetching update payload... ${Math.round(progress)}%`}
              {status === 'ready' && `Valis v${version} is ready. Restart to apply changes.`}
            </p>

            <div className="mt-4">
              {status === 'available' && (
                <button
                  onClick={handleDownload}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download Now
                </button>
              )}
              {status === 'ready' && (
                <button
                  onClick={handleRestart}
                  className="w-full py-2 bg-emerald-500 text-black text-xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} /> Restart to Install
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};