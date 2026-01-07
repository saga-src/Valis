import React, { useState, useEffect, useMemo, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, GripHorizontal, MousePointer2, Check, LocateFixed } from 'lucide-react';
import { useOnboarding } from '../../../context/OnboardingContext';
import { SETUP_TOUR, WALKTHROUGH_TOUR, TourStep } from '../config/tourConfig';
import { cn } from '../../../lib/utils/cn';
import { IngestionStep } from './steps/IngestionStep';
import { useNavigate, useLocation } from '../../../app/index';
import { TourSpotlight } from './TourSpotlight';

export const TourOverlay: React.FC = () => {
  const { activeTour, currentStep, nextStep, startTour, endTour, completeTour } = useOnboarding();
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

  // Fetch linked accounts to handle dynamic targets for the Sync step
  useEffect(() => {
    const fetchLinked = async () => {
      if (!window.api || !activeTour) return;
      const platforms = ['steam', 'epic', 'psn', 'xbox'];
      try {
        const results = await Promise.all(platforms.map(p => window.api.getLinkedAccounts(p)));
        const connected = platforms.filter((_, i) => results[i] && results[i].length > 0);
        setLinkedPlatforms(connected);
      } catch (e) {
        console.error('[TourOverlay] Failed to fetch linked accounts:', e);
      }
    };
    fetchLinked();
  }, [currentStep, activeTour]);

  // Resolve dynamic targets based on component state
  const activeTarget = useMemo(() => {
    if (!step) return null;
    if (step.id === 'trigger-sync') {
        // Priority: Steam > PlayStation > Xbox > Epic
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

  // 1. Target Watcher: Poll for target availability and visibility (Throttled)
  useEffect(() => {
    setIsTargetReady(false);
    setTargetRect(null);

    if (!activeTour || !step || showCompletionModal) return;

    // CASE 1: No Target (e.g., Welcome Modal) -> Ready immediately
    if (!activeTarget) {
      setIsTargetReady(true);
      return;
    }

    // CASE 2: Has Target -> Poll for it
    const checkTarget = () => {
      const el = document.querySelector(activeTarget!);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Ensure it's actually visible/rendered (width > 0)
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          setIsTargetReady(true);
          return true;
        }
      }
      return false;
    };

    // Initial check
    if (checkTarget()) return;

    // Throttled Retry loop (every 500ms for 5 seconds) to wait for page transitions
    const interval = setInterval(() => {
      if (checkTarget()) clearInterval(interval);
    }, 500);

    // Timeout safety (stop looking after 5s)
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep, activeTour, step, showCompletionModal, activeTarget]);

  // 2. Handle Route Auto-Navigation Detection
  useEffect(() => {
    if (!activeTour || !step?.waitForRoute || showCompletionModal) return;

    const isMatch = location.pathname.includes(step.waitForRoute) || 
                    location.search.includes(step.waitForRoute);

    if (isMatch) {
      const timer = setTimeout(() => {
        nextStep();
      }, 300); // 300ms delay for UI transition
      return () => clearTimeout(timer);
    }
  }, [location, step, activeTour, nextStep, showCompletionModal]);

  // 3. Handle Initial Route Navigation
  useEffect(() => {
    if (!activeTour || !step || showCompletionModal) return;
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [currentStep, activeTour, navigate, location.pathname, step, showCompletionModal]);

  // 4. Handle Action-based Triggers
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

  // 5. Position monitoring for the card and spotlight (Debounced)
  useEffect(() => {
    if (!activeTour || !activeTarget || !isTargetReady || showCompletionModal) return;

    let debounceTimeout: any;

    const updateRect = () => {
      const el = document.querySelector(activeTarget!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    const debouncedUpdate = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(updateRect, 200);
    };

    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('scroll', debouncedUpdate, true);

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      window.removeEventListener('scroll', debouncedUpdate, true);
      clearTimeout(debounceTimeout);
    };
  }, [activeTour, currentStep, activeTarget, isTargetReady, showCompletionModal]);

  // 6. Auto-scroll to target when step changes
  useEffect(() => {
    if (!activeTour || !activeTarget || !isTargetReady || showCompletionModal) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(activeTarget!);
      if (el) {
        el.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
    }, 300); // 300ms delay to allow modals to open/animations to finish

    return () => clearTimeout(timer);
  }, [currentStep, activeTarget, isTargetReady, activeTour, showCompletionModal]);

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
    
    if (targetRect.top < vh / 2) {
      styles.bottom = '100px';
    } else {
      styles.top = '100px';
    }

    if (targetRect.left < vw / 2) {
      styles.right = '100px';
    } else {
      styles.left = '100px';
    }

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
          {/* Decorative background glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />

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
                  
                  // 1. Mark Setup as Complete (await DB save)
                  await completeTour('SETUP');
                  
                  // 2. Trigger Navigation to library
                  navigate('/');

                  // 3. Start Tour 2 with a delay to survive the route change
                  setTimeout(() => {
                    startTour('WALKTHROUGH');
                  }, 500);
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

  const handleNext = () => {
    if (isLastStep) {
      if (activeTour === 'SETUP') {
        setShowCompletionModal(true);
      } else {
        completeTour('WALKTHROUGH');
      }
    } else {
      nextStep();
    }
  };

  const handleForceNav = () => {
    if (step.waitForRoute) {
      navigate(step.waitForRoute);
    } else if (step.route) {
      navigate(step.route);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && (anchor.href.startsWith('http://') || anchor.href.startsWith('https://'))) {
      e.preventDefault();
      if (window.api?.openExternal) {
        window.api.openExternal(anchor.href);
      }
    }
  };

  const hasFoundTarget = !!(activeTarget && targetRect && targetRect.width > 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* 1. Backdrop */}
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

      {/* 2. SVG Spotlight */}
      {hasFoundTarget && (
        <TourSpotlight 
          targetRect={targetRect}
          padding={step.padding ?? 10} 
          borderRadius={12} 
        />
      )}

      {/* Interaction Blocker for Hole (if disabled) */}
      {hasFoundTarget && step.disableOverlayInteraction && (
          <div 
            className="fixed z-[9999] pointer-events-auto cursor-default"
            style={{
                top: targetRect.top - (step.padding ?? 10),
                left: targetRect.left - (step.padding ?? 10),
                width: targetRect.width + (step.padding ?? 10) * 2,
                height: targetRect.height + (step.padding ?? 10) * 2,
                borderRadius: 12
            }}
          />
      )}

      {/* 3. Draggable Instruction Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          drag={hasFoundTarget}
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={cn(
            "w-80 bg-zinc-900/95 border border-white/10 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden pointer-events-auto cursor-default z-[10000]",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none"
          )}
          style={cardPosition}
          onClick={handleCardClick}
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
                  <button 
                    onClick={handleRecenter}
                    title="Locate Target"
                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors shrink-0"
                  >
                    <LocateFixed className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.body}</p>
            </div>

            {step.id === 'link-accounts' && <IngestionStep />}
            {step.component && <div className="pt-2">{step.component}</div>}

            <div className="flex flex-col gap-2 pt-2">
              {step.trigger === 'click' ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg text-primary text-[10px] font-black uppercase tracking-wider animate-pulse border border-primary/20">
                    <MousePointer2 size={12} />
                    Click highlighted element
                  </div>
                  {(step.waitForRoute || step.route) && (
                    <button 
                      onClick={handleForceNav}
                      className="text-xs text-emerald-400 hover:underline font-bold text-center py-1"
                    >
                      Having trouble? Click here to go
                    </button>
                  )}
                </>
              ) : (
                <div className="flex gap-2">
                  <button onClick={endTour} className="px-3 py-2 font-bold text-zinc-500 hover:text-white transition-colors">
                    Skip
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/20"
                  >
                    {step.actionLabel || (isLastStep ? 'Finish' : 'Continue')}
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
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