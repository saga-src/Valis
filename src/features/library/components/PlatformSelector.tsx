import React from 'react';
import { CUSTOM_PLATFORMS, CUSTOM_PLATFORM_DATA, PlatformOwnership } from '../../../types/index';
import { cn } from '../../../lib/utils/cn';

interface PlatformSelectorProps {
  availablePlatforms?: { id: number; name: string }[];
  selectedOwnership: PlatformOwnership[];
  onChange: (ownership: PlatformOwnership[]) => void;
  className?: string;
}

export const PlatformSelector: React.FC<PlatformSelectorProps> = ({ 
  availablePlatforms = [], 
  selectedOwnership, 
  onChange,
  className 
}) => {
  
  const togglePlatform = (id: number) => {
    const exists = selectedOwnership.find(p => p.id === id);
    if (exists) {
      // Remove
      onChange(selectedOwnership.filter(p => p.id !== id));
    } else {
      // Add with default price 0
      onChange([...selectedOwnership, { id, price: 0 }]);
    }
  };

  const updatePrice = (id: number, price: number) => {
    onChange(selectedOwnership.map(p => 
      p.id === id ? { ...p, price } : p
    ));
  };

  const isSelected = (id: number) => selectedOwnership.some(p => p.id === id);
  const getOwnership = (id: number) => selectedOwnership.find(p => p.id === id);

  // 1. Check if PC is a valid platform for this game (IGDB ID 6 = PC (Windows))
  const hasPC = availablePlatforms.some(p => p.id === 6);

  // 2. Filter out generic "PC (Windows)" (ID 6) so it doesn't show in the standard list
  const standardPlatforms = availablePlatforms.filter(p => p.id !== 6);

  // 3. Prepare the PC Store Options
  const pcStores = [
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.STEAM],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.EPIC],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.GOG],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.XBOX_PC],
    CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.STANDALONE],
  ];

  const unofficial = CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.UNOFFICIAL];
  const steamTools = CUSTOM_PLATFORM_DATA[CUSTOM_PLATFORMS.STEAM_TOOLS];

  const renderButton = (p: { id: number; name: string }, isDestructive = false, isPcStore = false) => {
    const selected = isSelected(p.id);
    const ownership = getOwnership(p.id);

    return (
      <div key={p.id} className="flex items-center gap-2">
        <button
          onClick={() => togglePlatform(p.id)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
            selected
              ? isDestructive 
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : isPcStore 
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted text-muted-foreground"
          )}
        >
          {isDestructive && <span>☠️ </span>}
          {p.name}
        </button>
        
        {/* Price Input when selected */}
        {selected && !isDestructive && (
            <div className="relative w-20 animate-in fade-in zoom-in-95 duration-200">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={ownership?.price || 0}
                    onChange={(e) => updatePrice(p.id, parseFloat(e.target.value))}
                    className="w-full pl-5 pr-1 py-1 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary outline-none"
                    placeholder="0.00"
                />
            </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Standard Consoles */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {standardPlatforms.length > 0 ? (
          standardPlatforms.map(p => renderButton(p))
        ) : (
          !hasPC && <span className="text-sm text-muted-foreground italic">No standard platforms found.</span>
        )}
      </div>

      {/* PC Stores Section - Render ONLY if the game is available on PC */}
      {hasPC && (
        <div className="pt-2 border-t">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">PC Stores</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {pcStores.map(p => renderButton(p, false, true))}
          </div>
        </div>
      )}

      {/* Unofficial Copy & SteamTools */}
      <div className="pt-2 border-t">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {renderButton(unofficial, true)}
            {/* SteamTools only if PC is available */}
            {hasPC && renderButton(steamTools, true)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Unofficial copies are always tracked as $0 cost.</p>
      </div>
    </div>
  );
};