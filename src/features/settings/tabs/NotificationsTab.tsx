
import React from 'react';
import { HeartPulse, Bell, Volume2, PlayCircle, RefreshCw, Trophy, Medal, Fingerprint } from 'lucide-react';
import { useSettings } from '../useSettings';
import { triggerHealthAlert } from '../../health/notifications';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils/cn';

export const NotificationsTab = () => {
  const { toast } = useToast();
  const { 
    healthCheckEnabled, setHealthCheckEnabled, healthThreshold, setHealthThreshold,
    healthSound, setHealthSound, healthToast, setHealthToast,
    achievementToast, setAchievementToast, achievementSound, setAchievementSound,
    milestoneToast, setMilestoneToast, milestoneSound, setMilestoneSound,
    protocolToast, setProtocolToast, protocolSound, setProtocolSound
  } = useSettings();

  const handleScan = async () => {
    toast.info('Scanning game files...');
    try {
        const result = await window.api.scanAchievements();
        result.success ? toast.success(`Checked ${result.count} files.`) : toast.error('Scan failed');
    } catch { toast.error('Scan error'); }
  };

  const handleTestMilestone = () => {
    window.dispatchEvent(new CustomEvent('TEST_MILESTONE_TOAST', { 
        detail: { title: "System Operational", archetype: "Diagnostics" } 
    }));
  };

  const handleTestProtocol = () => {
    const event = new CustomEvent('unlock_protocol', { 
      detail: {
        id: 'test_protocol',
        title: 'The Test Subject',
        lore: 'System diagnostics initiated. Anomalies detected.',
        visual: 'glitch', 
        iconName: 'Terminal'
      }
    });
    window.dispatchEvent(event);
  };

  const Toggle = ({ checked, onChange }: any) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
    </label>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex flex-col gap-2 mb-2">
            <h2 className="text-2xl font-bold">Notifications</h2>
            <p className="text-muted-foreground">Manage alerts and sound effects.</p>
        </div>

        {/* Health Monitor */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <HeartPulse size={20} className="text-primary" /> Wellness
            </h2>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="font-bold text-sm">"Touch Grass" Reminders</p>
                    <p className="text-xs text-muted-foreground">Alerts you when a gaming session exceeds the set duration.</p>
                </div>
                <Toggle checked={healthCheckEnabled} onChange={setHealthCheckEnabled} />
            </div>
            {healthCheckEnabled && (
                <div className="space-y-6 pl-4 border-l-2 border-primary/20 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                            <span>Remind after</span>
                            <span className="text-primary font-mono">{healthThreshold} min</span>
                        </div>
                        <input type="range" min="30" max="480" step="30" value={healthThreshold} onChange={(e) => setHealthThreshold(Number(e.target.value))} className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setHealthSound(!healthSound)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", healthSound ? "bg-primary/10 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground")}><Volume2 size={16} /> Sound</button>
                        <button onClick={() => setHealthToast(!healthToast)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", healthToast ? "bg-primary/10 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground")}><Bell size={16} /> Popup</button>
                        <button onClick={() => triggerHealthAlert(healthSound, healthToast, 150)} className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted text-xs font-bold transition-all"><PlayCircle size={16} /> Test</button>
                    </div>
                </div>
            )}
        </div>

        {/* Achievement Telemetry */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Trophy size={20} className="text-primary" /> Achievement Telemetry
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleScan} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted text-xs font-bold transition-colors"><RefreshCw size={14} /> Scan Files</button>
                    <button onClick={() => window.api.testNotification({ toast: achievementToast, sound: achievementSound })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted text-xs font-bold transition-colors"><PlayCircle size={14} /> Test</button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Notifications for local achievement unlocks tracked via Watch Paths.</p>
            <div className="flex gap-3">
                <button onClick={() => setAchievementSound(!achievementSound)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", achievementSound ? "bg-primary/10 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground")}><Volume2 size={16} /> Sound</button>
                <button onClick={() => setAchievementToast(!achievementToast)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", achievementToast ? "bg-primary/10 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground")}><Bell size={16} /> Popup</button>
            </div>
        </div>

        {/* Milestones (Gamification) */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Medal size={20} className="text-purple-500" /> Milestones
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleTestMilestone} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted text-xs font-bold transition-colors"><PlayCircle size={14} /> Test</button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Visual and audio cues when you rank up in the Valis Protocol.</p>
            <div className="flex gap-3">
                <button onClick={() => setMilestoneSound(!milestoneSound)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", milestoneSound ? "bg-purple-500/10 border-purple-500 text-purple-500" : "bg-muted border-transparent text-muted-foreground")}><Volume2 size={16} /> Sound</button>
                <button onClick={() => setMilestoneToast(!milestoneToast)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", milestoneToast ? "bg-purple-500/10 border-purple-500 text-purple-500" : "bg-muted border-transparent text-muted-foreground")}><Bell size={16} /> Popup</button>
            </div>
        </div>

        {/* Unique Artifacts (Protocols) */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Fingerprint size={20} className="text-cyan-500" /> Unique Artifacts
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleTestProtocol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted text-xs font-bold transition-colors"><PlayCircle size={14} /> Test</button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Rare protocol discoveries and secret system anomalies.</p>
            <div className="flex gap-3">
                <button onClick={() => setProtocolSound(!protocolSound)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", protocolSound ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-muted border-transparent text-muted-foreground")}><Volume2 size={16} /> Sound</button>
                <button onClick={() => setProtocolToast(!protocolToast)} className={cn("px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all", protocolToast ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-muted border-transparent text-muted-foreground")}><Bell size={16} /> Popup</button>
            </div>
        </div>
    </div>
  );
};
