import React from 'react';
import { Monitor, Gamepad2, Smartphone, Box, Skull } from 'lucide-react';
import { CUSTOM_PLATFORMS } from '../../types/index';

export const PlatformIcon = ({ platformId, platformName, size = 14, className = "" }: { platformId?: number, platformName?: string, size?: number, className?: string }) => {
  if (!platformId && !platformName) return null;
  
  const name = platformName?.toLowerCase() || '';

  if (platformId === CUSTOM_PLATFORMS.UNOFFICIAL || platformId === CUSTOM_PLATFORMS.STEAM_TOOLS) {
    return <Skull size={size} className={`text-destructive ${className}`} />;
  }
  
  // PC / Desktop
  if (name.includes('pc') || name.includes('win') || (platformId && platformId >= 99000 && platformId < 99999)) {
    return <Monitor size={size} className={className} />;
  }
  
  // Consoles
  if (name.includes('playstation') || name.includes('xbox') || name.includes('nintendo') || name.includes('switch') || name.includes('wii') || name.includes('3ds')) {
    return <Gamepad2 size={size} className={className} />;
  }
  
  // Mobile
  if (name.includes('mobile') || name.includes('ios') || name.includes('android')) {
    return <Smartphone size={size} className={className} />;
  }

  return <Box size={size} className={className} />;
};