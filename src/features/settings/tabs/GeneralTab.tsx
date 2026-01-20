import React, { useState, useEffect } from 'react';
import { Zap, MousePointerClick, MonitorUp, Rocket } from 'lucide-react';
import { useSettings } from '../useSettings';
import { cn } from '../../../lib/utils/cn';
import { getSetting, saveSetting } from '../../../lib/storage';

export const GeneralTab = () => {
  const { 
    autoTrackingEnabled, autoTrackingInterval, setAutoTracking,
    libraryAction, setLibraryAction,
    startAtLogin, setStartAtLogin
  } = useSettings();

  // 1. Optimistic State Initialization
  const [libraryCacheEnabled, setLibraryCacheEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 2. Fetch initial value on mount
  useEffect(() => {
    const loadCacheSetting = async () => {
        try {
            const val = await getSetting('enable_library_cache');
            setLibraryCacheEnabled(!!val);
        } catch (e) {
            console.error('[Settings] Failed to load cache setting:', e);
        } finally {
            setIsLoaded(true);
        }
    };
    loadCacheSetting();
  }, []);

  // 3. Optimistic Handler
  const handleToggleCache = (val: boolean) => {
    setLibraryCacheEnabled(val); // Instant feedback
    saveSetting('enable_library_cache', val).catch(e => {
        console.error('[Settings] Failed to save cache setting:', e);
        // Optional: revert state if save fails
        // setLibraryCacheEnabled(!val);
    });
  };

  const Toggle = ({ checked, onChange }: any) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-bold">General Settings</h2>
        <p className="text-muted-foreground">Configure core application behavior.</p>
      </div>

      {/* OS Integration */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MonitorUp size={20} className="text-primary" /> OS Integration
        </h2>
        <div className="flex items-center justify-between">
            <div>
                <p className="font-bold text-sm">Start with Windows</p>
                <p className="text-xs text-muted-foreground">Automatically launch Valis when you sign in to your computer.</p>
            </div>
            <Toggle checked={startAtLogin} onChange={setStartAtLogin} />
        </div>
      </div>

      {/* Performance Section */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Rocket size={20} className="text-primary" /> Performance
        </h2>
        <div className="flex items-center justify-between">
            <div>
                <p className="font-bold text-sm">Enable Library Cache <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-1">EXPERIMENTAL</span></p>
                <p className="text-xs text-muted-foreground">Keeps library loaded in memory for instant switching. Disable if you experience sync issues.</p>
            </div>
            <Toggle 
                checked={libraryCacheEnabled} 
                onChange={handleToggleCache} 
                disabled={!isLoaded}
            />
        </div>
      </div>

      {/* Auto-Tracking Section */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            < Zap size={20} className="text-primary" /> Auto-Tracking
        </h2>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-bold text-sm">Enable Process Watcher</p>
                    <p className="text-xs text-muted-foreground">Monitor running .exe files to automatically start sessions.</p>
                </div>
                <Toggle checked={autoTrackingEnabled} onChange={(val: boolean) => setAutoTracking(val, autoTrackingInterval)} />
            </div>
            {autoTrackingEnabled && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-4 border-l-2 border-primary/20 animate-in slide-in-from-top-2">
                    <div>
                        <p className="font-bold text-sm">Check Frequency</p>
                        <p className="text-xs text-muted-foreground">How often to scan active processes.</p>
                    </div>
                    <select 
                        value={autoTrackingInterval} 
                        onChange={(e) => setAutoTracking(true, parseInt(e.target.value))} 
                        className="p-2 border rounded-lg bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    >
                        <option value={1000}>1 second (High Precision)</option>
                        <option value={5000}>5 seconds (Balanced)</option>
                        <option value={30000}>30 seconds (Low Resource)</option>
                    </select>
                </div>
            )}
        </div>
      </div>

      {/* Library Interaction */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MousePointerClick size={20} className="text-primary" /> Library Interaction
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <p className="font-bold text-sm">Default Click Action</p>
                <p className="text-xs text-muted-foreground">Behavior when clicking a game cover in the library.</p>
            </div>
            <div className="flex bg-muted p-1 rounded-lg">
                <button onClick={() => setLibraryAction('details')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all", libraryAction === 'details' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>View Details</button>
                <button onClick={() => setLibraryAction('play')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all", libraryAction === 'play' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Quick Play</button>
            </div>
        </div>
      </div>
    </div>
  );
};
