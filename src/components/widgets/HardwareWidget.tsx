
import React, { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, Zap } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useSystemMonitor } from '../ui/hooks/useSystemMonitor';

interface HardwareWidgetProps {
  variant?: 'dashboard' | 'sidebar';
  className?: string;
  // Fallback prop still allowed for direct override if needed, but not required
  settings?: { cpu: boolean; gpu: boolean; ram: boolean };
}

interface SystemStats {
  cpuLoad: number;
  memUsed: number;
  gpuLoad: number;
  gpuName: string;
}

export const HardwareWidget: React.FC<HardwareWidgetProps> = ({ 
  variant = 'dashboard', 
  className,
  settings: propSettings 
}) => {
  // Connect to shared settings
  const [globalSettings] = useSystemMonitor();
  
  // Use props if provided, otherwise fallback to global settings
  const settings = propSettings || globalSettings;

  const [stats, setStats] = useState<SystemStats>({ 
    cpuLoad: 0, memUsed: 0, gpuLoad: 0, gpuName: 'GPU' 
  });

  useEffect(() => {
    // Only fetch if at least one metric is enabled
    if (!settings.cpu && !settings.gpu && !settings.ram) return;

    const fetchStats = async () => {
      if (window.api && window.api.getSystemStats) {
        try {
          const data = await window.api.getSystemStats();
          setStats(data);
        } catch (e) {
          console.error('Failed to fetch system stats:', e);
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [settings.cpu, settings.gpu, settings.ram]);

  // Global Off Switch: If everything is disabled, hide the entire widget
  if (!settings.cpu && !settings.gpu && !settings.ram) return null;

  // Helper for progress bar color
  const getColor = (val: number) => {
    if (val > 80) return 'bg-red-500';
    if (val > 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // --- SIDEBAR VARIANT ---
  if (variant === 'sidebar') {
    return (
      <div className={cn("px-4 py-4 border-t border-border/10 bg-black/10 mt-auto", className)}>
        <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <Activity size={12} /> System
        </div>

        <div className="space-y-3">
          {settings.cpu && (
            <div className="group">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span className="flex items-center gap-1"><Cpu size={10} /> CPU</span>
                <span className="font-mono text-foreground">{stats.cpuLoad}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-500", getColor(stats.cpuLoad))} style={{ width: `${stats.cpuLoad}%` }} />
              </div>
            </div>
          )}

          {settings.gpu && (
            <div className="group">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span className="flex items-center gap-1"><Zap size={10} /> GPU</span>
                <span className="font-mono text-foreground">{stats.gpuLoad}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-500", getColor(stats.gpuLoad))} style={{ width: `${stats.gpuLoad}%` }} />
              </div>
            </div>
          )}

          {settings.ram && (
            <div className="group">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span className="flex items-center gap-1"><HardDrive size={10} /> RAM</span>
                <span className="font-mono text-foreground">{stats.memUsed}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-500", getColor(stats.memUsed))} style={{ width: `${stats.memUsed}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- DASHBOARD VARIANT ---
  const activeMetrics = [settings.cpu, settings.gpu, settings.ram].filter(Boolean).length;
  const gridClass = activeMetrics === 1 ? 'grid-cols-1' : activeMetrics === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={cn("bg-secondary/20 p-4 rounded-xl border border-white/5 backdrop-blur-md", className)}>
      <h3 className="text-xs font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2">
        <Activity size={14} /> System Monitor
      </h3>
      
      <div className={`grid ${gridClass} gap-4`}>
        {settings.cpu && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu size={14} /> <span className="text-[10px]">CPU</span>
            </div>
            <span className="text-xl font-mono font-bold text-foreground">{stats.cpuLoad}%</span>
            <div className="h-1 w-full bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${stats.cpuLoad}%` }} />
            </div>
          </div>
        )}

        {settings.gpu && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap size={14} /> <span className="text-[10px]">GPU</span>
            </div>
            <span className="text-xl font-mono font-bold text-foreground">{stats.gpuLoad}%</span>
            <div className="h-1 w-full bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${stats.gpuLoad}%` }} />
            </div>
          </div>
        )}

        {settings.ram && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <HardDrive size={14} /> <span className="text-[10px]">RAM</span>
            </div>
            <span className="text-xl font-mono font-bold text-foreground">{stats.memUsed}%</span>
            <div className="h-1 w-full bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${stats.memUsed}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HardwareWidget;
