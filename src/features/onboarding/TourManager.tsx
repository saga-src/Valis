import React from 'react';
import { useOnboarding } from '../../context/OnboardingContext';
import { TourOverlay } from './components/TourOverlay';

/**
 * TourManager
 * 
 * Performance wrapper that ensures TourOverlay and its associated heavy
 * polling hooks/observers are completely unmounted when no tour is active.
 */
export const TourManager: React.FC = () => {
  const { activeTour } = useOnboarding();

  if (!activeTour) {
    return null;
  }

  return <TourOverlay />;
};