
import React from 'react';
import { Sun, Moon, EyeOff, Activity } from 'lucide-react';
import { useTheme } from '../../../lib/theme';
import { useSettings } from '../useSettings';
// import { useSystemMonitor } from '../../../components/ui/hooks/useSystemMonitor'; -- Disabled due to performance lag (v1.0)
import { cn } from '../../../lib/utils/cn';

export const PersonalizationTab = () => {
  const { theme, changeTheme } = useTheme();
  const { museumMode, setMuseumMode } = useSettings();
  // const [monitorSettings, setMonitorSettings] = useSystemMonitor(); -- Disabled due to performance lag (v1.0)

  const ThemeCard = ({ active, onClick, icon, label, sub }: any) => (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 hover:bg-muted/50 w-full", active ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/20")}>
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
        <span className="font-bold text-sm">{label}</span>
        {sub && <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{sub}</span>}
    </button>
  );

  const Toggle = ({ checked, onChange }: any) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-bold">Personalization</h2>
        <p className="text-muted-foreground">Customize the look and feel of your vault.</p>
      </div>

      {/* Appearance */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">🎨 Theme & Visuals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <ThemeCard active={theme === 'light'} onClick={() => changeTheme('light')} icon={<Sun size={24} />} label="Light" />
            <ThemeCard active={theme === 'dark'} onClick={() => changeTheme('dark')} icon={<Moon size={24} />} label="Dark" />
            <ThemeCard active={theme === 'stealth'} onClick={() => changeTheme('stealth')} icon={<EyeOff size={24} />} label="Stealth" sub="Privacy Mode" />
        </div>
        <div className="flex items-center justify-between pt-6 border-t border-border/50">
          <div>
            <p className="font-bold text-sm">Museum of Code</p>
            <p className="text-xs text-muted-foreground">Enable refractive glass effects, crystalline data layouts, and high-fidelity animations.</p>
          </div>
          <Toggle checked={museumMode} onChange={setMuseumMode} />
        </div>
      </div>

      {/* System Monitor -- Disabled due to performance lag (v1.0)
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-primary" /> Dashboard Widgets
        </h2>
        <p className="text-xs text-muted-foreground mb-6">Configure hardware metrics displayed on the sidebar.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['cpu', 'gpu', 'ram'].map((metric) => (
                <div key={metric} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                    <span className="font-bold text-sm uppercase">Show {metric} Usage</span>
                    <Toggle 
                        checked={(monitorSettings as any)[metric]} 
                        onChange={(v: boolean) => setMonitorSettings({...monitorSettings, [metric]: v})} 
                    />
                </div>
            ))}
        </div>
      </div>
      */}
    </div>
  );
};
