import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSetting, saveSetting } from '../lib/storage';

export type TourId = 'SETUP' | 'WALKTHROUGH' | null;
export type SpotlightTarget = string;

interface OnboardingContextType {
  activeTour: TourId;
  currentStep: number;
  isCompleted: boolean;
  startTour: (tourId: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  completeTour: (tourId: 'SETUP' | 'WALKTHROUGH') => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTour, setActiveTour] = useState<TourId>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(true); // Default to true to prevent flash while loading settings

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Wait for API to be ready
        if (!window.api) {
          console.warn('[Onboarding] API not available yet.');
          return;
        }

        const setupDone = await getSetting('tour_setup_completed');
        const walkthroughDone = await getSetting('tour_walkthrough_completed');

        // Normalize flags
        const isSetupActuallyDone = (setupDone === 'true' || setupDone === true);
        const isWalkthroughActuallyDone = (walkthroughDone === 'true' || walkthroughDone === true);
        
        setIsCompleted(isSetupActuallyDone);
        
        // 1. Priority: Setup Tour
        if (!isSetupActuallyDone) {
          console.log('[Onboarding] Setup required. Starting Setup Tour.');
          setActiveTour('SETUP');
          setCurrentStep(0);
          return;
        }

        // 2. Secondary: Walkthrough Tour
        // Only start if Setup IS done, but Walkthrough is NOT done.
        if (!isWalkthroughActuallyDone) {
          console.log('[Onboarding] Setup done. Walkthrough required. Starting Walkthrough Tour.');
          setActiveTour('WALKTHROUGH');
          setCurrentStep(0);
          return;
        }

        // 3. Nothing to do
        console.log('[Onboarding] All tours completed.');
        setActiveTour(null);
      } catch (error) {
        console.error('[Onboarding] Failed to check status:', error);
      }
    };

    // Add a small timeout to ensure DB connection is active on cold start
    const timer = setTimeout(checkStatus, 500); 
    return () => clearTimeout(timer);
  }, []);

  const startTour = useCallback((tourId: TourId) => {
    setActiveTour(tourId);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const endTour = useCallback(() => {
    setActiveTour(null);
  }, []);

  const completeTour = useCallback(async (tourId: 'SETUP' | 'WALKTHROUGH') => {
    const key = tourId === 'SETUP' ? 'tour_setup_completed' : 'tour_walkthrough_completed';
    try {
      await saveSetting(key, true);
      if (tourId === 'SETUP') setIsCompleted(true);
      setActiveTour(null);
      setCurrentStep(0);
    } catch (error) {
      console.error('[Onboarding] Failed to persist completion status:', error);
    }
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        activeTour,
        currentStep,
        isCompleted,
        startTour,
        nextStep,
        prevStep,
        endTour,
        completeTour,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};