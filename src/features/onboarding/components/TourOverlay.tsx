import React, { useState, useEffect, useMemo, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, GripHorizontal, Check, LocateFixed } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '../../../context/OnboardingContext';
import { SETUP_TOUR, WALKTHROUGH_TOUR } from '../config/tourConfig';
import { cn } from '../../../lib/utils/cn';
import { TourSpotlight } from './TourSpotlight';
import { IngestionStep } from './steps/IngestionStep';

export const TourOverlay: React.FC = () => {
  const onboarding = useOnboarding();
  const { activeTour, currentStep, setCurrentStep, nextStep, startTour, endTour, completeTour } = onboarding;
  const navigate = useNavigate();
  const location = useLocation();
  
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTargetReady, setIsTargetReady] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [linkedPlatforms, setLinkedPlatforms] = useState<string[]>([]);

  const tourData = useMemo(() => {
    if (activeTour === 'SETUP') return SETUP_TOUR;
    if (activeTour === 'WALKTHROUGH') return WALKTHROUGH_TOUR;
    return [];
  }, [activeTour]);

  const step = tourData[currentStep];
  const isLastStep = currentStep === tourData.length - 1;

  // SPY LOGS: Log every step change for debugging
  useEffect(() => {
    if (activeTour && step) {
      console.log(`[TourSpy] Step Change: ${currentStep} (${step.id})`);
    }
  }, [currentStep, activeTour, step]);

  // Fetch linked accounts safely to handle dynamic targets for the Sync step
  useEffect(() => {
    const fetchLinked = async () => {
      if (!window.api || typeof window.api.getLinkedAccounts !== 'function' || !activeTour) return;
      const platforms = ['steam', 'epic', 'psn', 'xbox'];
      try {
        const results = await Promise.all(platforms.map(p => window.api.getLinkedAccounts(p)));
        const connected = platforms.filter((_, i) => Array.isArray(results[i]) && results[i].length > 0);
        setLinkedPlatforms(connected);
      } catch (e) {
        console.warn('[TourOverlay] Failed to fetch linked accounts:', e);
      }
    };
    fetchLinked();
  }, [currentStep, activeTour]);

  // Resolve dynamic targets based on component state
  const activeTarget = useMemo(() => {
    if (!step) return null;
    
    if (step.id === 'trigger-sync') {
        if (linkedPlatforms.includes('steam')) return '#btn-sync-steam';
        if (linkedPlatforms.includes('psn')) return '#btn-sync-psn';
        if (linkedPlatforms.includes('xbox')) return '#btn-sync-xbox';
        if (linkedPlatforms.includes('epic')) return '#btn-sync-epic';
        return '#integrations-content';
    }
    return step.target;
  }, [step, linkedPlatforms]);

  const handleRecenter = () => {
    if (!activeTarget) return;
    const el = document.querySelector(activeTarget);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  };

  // 1. Target Watcher: Poll for target availability and visibility
  useEffect(() => {
    setIsTargetReady(false);
    setTargetRect(null);

    if (!activeTour || !step || showCompletionModal) return;

    if (!activeTarget) {
      setIsTargetReady(true);
      return;
    }

    const updateTargetRect = () => {
      const el = document.querySelector(activeTarget!);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          setIsTargetReady(true);
          return true;
        }
      }
      return false;
    };

    // Initial attempt
    updateTargetRect();

    // Event listeners for smooth following during interactions
    window.addEventListener('scroll', updateTargetRect, { passive: true });
    window.addEventListener('resize', updateTargetRect);

    // Polling as safety fallback for complex layout shifts
    const interval = setInterval(() => {
      updateTargetRect();
    }, 500);

    const timeout = setTimeout(() => {
        if (!isTargetReady && !updateTargetRect()) {
            console.warn(`[TourSpy] Target not found: ${activeTarget}. Centering...`);
            setIsTargetReady(true);
        }
    }, 5000);

    return () => {
      window.removeEventListener('scroll', updateTargetRect);
      window.removeEventListener('resize', updateTargetRect);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep, activeTour, step, showCompletionModal, activeTarget]);

  // 2. Handle Action-based Triggers (Auto-advance on target click)
  useEffect(() => {
    if (activeTour && step?.trigger === 'click' && activeTarget && isTargetReady && !showCompletionModal) {
      const el = document.querySelector(activeTarget);
      if (el) {
        const handler = () => nextStep();
        el.addEventListener('click', handler);
        return () => el.removeEventListener('click', handler);
      }
    }
  }, [activeTour, currentStep, step, nextStep, isTargetReady, showCompletionModal, activeTarget]);

  const cardPosition = useMemo(() => {
    const centerPosition: CSSProperties = { 
        position: 'fixed', 
        zIndex: 10000, 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        margin: 0
    };
    
    if (!activeTarget || !targetRect || targetRect.width === 0) {
      return centerPosition;
    }
    
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const styles: CSSProperties = { position: 'fixed', zIndex: 10000 };
    
    if (targetRect.top < vh / 2) styles.bottom = '100px';
    else styles.top = '100px';

    if (targetRect.left < vw / 2) styles.right = '100px';
    else styles.left = '100px';

    return styles;
  }, [activeTarget, targetRect]);

  if (showCompletionModal) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-emerald-500/30 p-8 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
          <div className="relative z-10 text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 border border-emerald-500/50">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Setup Complete</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Your database has been initialized. Would you like a quick interactive tour of the features?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  setShowCompletionModal(false);
                  await completeTour('SETUP');
                  navigate('/');
                  setTimeout(() => startTour('WALKTHROUGH'), 500);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02]"
              >
                Start Walkthrough
              </button>
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  completeTour('SETUP');
                }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                No thanks, I'll explore myself
              </button>
            </div>
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  if (!activeTour || !step || (!isTargetReady && activeTarget)) return null;

  const handleGoToManual = () => {
      console.log('🕵️ Forcing Manual Setup Route');
      navigate('/settings/integrations');
      setTimeout(() => {
          const manualIndex = tourData.findIndex(s => s.id === 'steam-api-manual');
          if (manualIndex !== -1) {
            setCurrentStep(manualIndex);
          } else {
            nextStep();
          }
      }, 500);
  };

  const handleNext = async () => {
    console.log('🕵️ handleNext START');
    
    // 1. Branching Logic for Step 4 (link-accounts)
    if (step.id === 'link-accounts') {
        let connectedCount = 0;
        try {
            if (window.api && typeof window.api.getLinkedAccounts === 'function') {
                const platforms = ['steam', 'epic', 'psn', 'xbox'];
                const results = await Promise.all(platforms.map(p => window.api.getLinkedAccounts(p)));
                connectedCount = platforms.filter((_, i) => Array.isArray(results[i]) && results[i].length > 0).length;
            }
        } catch (e) {
            console.error('[TourOverlay] Account check failed:', e);
        }

        if (connectedCount > 0) {
            console.log('🕵️ Scenario A: Accounts Linked. Skipping to Sync.');
            const syncIndex = tourData.findIndex(s => s.id === 'trigger-sync');
            if (syncIndex !== -1) {
              setCurrentStep(syncIndex);
              return;
            }
        } else {
            console.log('🕵️ Scenario B: No accounts. Going to Manual.');
            handleGoToManual();
            return;
        }
    }

    // 2. Branching Logic for Step 5 (steam-api-manual)
    if (step.id === 'steam-api-manual') {
        let connectedCount = 0;
        try {
            if (window.api && typeof window.api.getLinkedAccounts === 'function') {
                const platforms = ['steam', 'epic', 'psn', 'xbox'];
                const results = await Promise.all(platforms.map(p => window.api.getLinkedAccounts(p)));
                connectedCount = platforms.filter((_, i) => Array.isArray(results[i]) && results[i].length > 0).length;
            }
        } catch (e) {
            console.error('[TourOverlay] Account check failed at Step 5:', e);
        }

        if (connectedCount === 0) {
            console.log('🕵️ Skip Sync: No accounts linked. Jumping to Watcher.');
            const watcherIndex = tourData.findIndex(s => s.id === 'watcher');
            if (watcherIndex !== -1) {
                setCurrentStep(watcherIndex);
                return;
            }
        }
    }

    // 3. Generic Auto-Navigation for next step
    const nextIndex = currentStep + 1;
    if (nextIndex < tourData.length) {
      const nextConfig = tourData[nextIndex];
      const currentPath = location.pathname.replace(/\/$/, '') || '/';
      const targetPath = nextConfig.route?.replace(/\/$/, '') || null;

      if (targetPath && currentPath !== targetPath) {
        console.log(`[TourSpy] Auto-navigating to ${targetPath} for next step: ${nextConfig.id}`);
        navigate(targetPath);
        // Add a small delay (100ms) before setting the next step
        setTimeout(() => nextStep(), 100);
        return;
      }
    }

    // 4. Final step or proceed
    if (isLastStep) {
      if (activeTour === 'SETUP') setShowCompletionModal(true);
      else completeTour('WALKTHROUGH');
    } else {
      nextStep();
    }
  };

  const hasFoundTarget = !!(activeTarget && targetRect && targetRect.width > 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {!hasFoundTarget && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
          />
        )}
      </AnimatePresence>

      {hasFoundTarget && (
        <TourSpotlight 
          targetRect={targetRect}
          padding={step.padding ?? 10} 
          borderRadius={12} 
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          drag={hasFoundTarget}
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={cn(
            "w-80 bg-zinc-900/95 border border-white/10 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden pointer-events-auto cursor-default z-[10000]"
          )}
          style={cardPosition}
        >
          <div className="drag-handle h-6 flex items-center justify-center bg-white/5 border-b border-white/5 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors">
            <GripHorizontal size={14} />
          </div>

          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Step {currentStep + 1} of {tourData.length}</span>
              <button onClick={endTour} className="text-zinc-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-white leading-tight text-lg">{step.title}</h3>
                {activeTarget && (
                  <button onClick={handleRecenter} className="p-1.5 text-zinc-500 hover:text-emerald-400 rounded-md transition-colors shrink-0">
                    <LocateFixed className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.body}</p>
            </div>

            {step.id === 'link-accounts' && (
              <div className="pt-2">
                <IngestionStep 
                    onLinkLater={handleGoToManual} 
                />
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button onClick={endTour} className="px-3 py-2 font-bold text-zinc-500 hover:text-white transition-colors">Skip</button>
                <button
                    onClick={handleNext}
                    className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/20"
                >
                    {step.actionLabel || (isLastStep ? 'Finish' : 'Next')}
                    <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="h-1 w-full bg-zinc-800">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / tourData.length) * 100}%` }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};