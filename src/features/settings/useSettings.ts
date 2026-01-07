import { useState, useEffect, useCallback } from 'react';
import { getSetting, saveSetting } from '../../lib/storage';
import { useToast } from '../../context/ToastContext';

type LibraryAction = 'details' | 'play';

export const useSettings = () => {
  const { toast } = useToast();

  // Local State
  const [libraryAction, setLibraryActionState] = useState<LibraryAction>('details');
  const [healthCheckEnabled, setHealthCheckEnabledState] = useState(true);
  const [healthThreshold, setHealthThresholdState] = useState(120);
  const [healthSound, setHealthSoundState] = useState(true);
  const [healthToast, setHealthToastState] = useState(true);
  const [showDlc, setShowDlcState] = useState(true);
  const [autoTrackingEnabled, setAutoTrackingEnabledState] = useState(true);
  const [autoTrackingInterval, setAutoTrackingIntervalState] = useState(5000);
  const [museumMode, setMuseumModeState] = useState(false);
  const [enableShardEffect, setEnableShardEffectState] = useState(true);
  const [achievementToast, setAchievementToastState] = useState(true);
  const [achievementSound, setAchievementSoundState] = useState(true);
  const [startAtLogin, setStartAtLoginState] = useState(false);
  
  // Milestones Settings
  const [milestoneToast, setMilestoneToastState] = useState(true);
  const [milestoneSound, setMilestoneSoundState] = useState(true);

  // ⚡ Protocol Settings
  const [protocolToast, setProtocolToastState] = useState(true);
  const [protocolSound, setProtocolSoundState] = useState(true);

  const [hardwareCpu, setHardwareCpuState] = useState(true);
  const [hardwareGpu, setHardwareGpuState] = useState(true);
  const [hardwareRam, setHardwareRamState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // SQL Persistence Helper
  const updateSqlSetting = useCallback(async (key: string, value: any) => {
    try {
      await saveSetting(key, value);
    } catch (e) {
      console.error(`Failed to save SQL setting ${key}:`, e);
    }
  }, []);

  // Load from SQL on mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [
          la, hc, ht, hs, hto, sd, ate, ati, mm, es, at, as,
          mt, ms, // Milestones
          pt, ps, // Protocols
          hCpu, hGpu, hRam,
          startupStatus
        ] = await Promise.all([
          getSetting('library_action'),
          getSetting('health_enabled'),
          getSetting('health_threshold'),
          getSetting('health_sound'),
          getSetting('health_toast'),
          getSetting('show_dlc'),
          getSetting('auto_tracking_enabled'),
          getSetting('auto_tracking_interval'),
          getSetting('museum_mode'),
          getSetting('enable_shard_effect'),
          getSetting('achievement_toast'),
          getSetting('achievement_sound'),
          getSetting('milestone_toast'),
          getSetting('milestone_sound'),
          getSetting('protocol_toast'),
          getSetting('protocol_sound'),
          getSetting('hardware_cpu'),
          getSetting('hardware_gpu'),
          getSetting('hardware_ram'),
          window.api?.getStartupStatus?.()
        ]);

        if (la) setLibraryActionState(la);
        if (hc !== null) setHealthCheckEnabledState(hc);
        if (ht) setHealthThresholdState(ht);
        if (hs !== null) setHealthSoundState(hs);
        if (hto !== null) setHealthToastState(hto);
        if (sd !== null) setShowDlcState(sd);
        if (ate !== null) setAutoTrackingEnabledState(ate);
        if (ati) setAutoTrackingIntervalState(ati);
        if (mm !== null) setMuseumModeState(mm);
        if (es !== null) setEnableShardEffectState(es);
        if (at !== null) setAchievementToastState(at);
        if (as !== null) setAchievementSoundState(as);
        if (mt !== null) setMilestoneToastState(mt);
        if (ms !== null) setMilestoneSoundState(ms);
        if (pt !== null) setProtocolToastState(pt);
        if (ps !== null) setProtocolSoundState(ps);
        if (hCpu !== null) setHardwareCpuState(hCpu);
        if (hGpu !== null) setHardwareGpuState(hGpu);
        if (hRam !== null) setHardwareRamState(hRam);
        if (startupStatus !== undefined) setStartAtLoginState(startupStatus);
        
        // Sync Watcher to initial values
        if (window.api && window.api.updateWatcherSettings) {
            window.api.updateWatcherSettings({
                enabled: ate ?? autoTrackingEnabled,
                interval: ati ?? autoTrackingInterval
            });
        }
      } catch (e) {
        console.error("Failed to load settings from SQL", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Setters
  const setLibraryAction = (action: LibraryAction) => {
    setLibraryActionState(action);
    updateSqlSetting('library_action', action);
  };

  const setHealthCheckEnabled = (enabled: boolean) => {
    setHealthCheckEnabledState(enabled);
    updateSqlSetting('health_enabled', enabled);
  };

  const setHealthThreshold = (minutes: number) => {
    setHealthThresholdState(minutes);
    updateSqlSetting('health_threshold', minutes);
  };

  const setHealthSound = (enabled: boolean) => {
    setHealthSoundState(enabled);
    updateSqlSetting('health_sound', enabled);
  };

  const setHealthToast = (enabled: boolean) => {
    setHealthToastState(enabled);
    updateSqlSetting('health_toast', enabled);
  };

  const setShowDlc = (show: boolean) => {
    setShowDlcState(show);
    updateSqlSetting('show_dlc', show);
  };

  const setAutoTracking = (enabled: boolean, interval: number) => {
    setAutoTrackingEnabledState(enabled);
    setAutoTrackingIntervalState(interval);
    updateSqlSetting('auto_tracking_enabled', enabled);
    updateSqlSetting('auto_tracking_interval', interval);
    
    if (window.api && window.api.updateWatcherSettings) {
        window.api.updateWatcherSettings({ enabled, interval });
    }
  };

  const setMuseumMode = (enabled: boolean) => {
    setMuseumModeState(enabled);
    updateSqlSetting('museum_mode', enabled);
  };

  const setEnableShardEffect = (enabled: boolean) => {
    setEnableShardEffectState(enabled);
    updateSqlSetting('enable_shard_effect', enabled);
  };

  const setAchievementToast = (enabled: boolean) => {
    setAchievementToastState(enabled);
    updateSqlSetting('achievement_toast', enabled);
  };

  const setAchievementSound = (enabled: boolean) => {
    setAchievementSoundState(enabled);
    updateSqlSetting('achievement_sound', enabled);
  };

  const setMilestoneToast = (enabled: boolean) => {
    setMilestoneToastState(enabled);
    updateSqlSetting('milestone_toast', enabled);
  };

  const setMilestoneSound = (enabled: boolean) => {
    setMilestoneSoundState(enabled);
    updateSqlSetting('milestone_sound', enabled);
  };

  const setProtocolToast = (enabled: boolean) => {
    setProtocolToastState(enabled);
    updateSqlSetting('protocol_toast', enabled);
  };

  const setProtocolSound = (enabled: boolean) => {
    setProtocolSoundState(enabled);
    updateSqlSetting('protocol_sound', enabled);
  };

  const setHardwareCpu = (enabled: boolean) => {
    setHardwareCpuState(enabled);
    updateSqlSetting('hardware_cpu', enabled);
  };

  const setHardwareGpu = (enabled: boolean) => {
    setHardwareGpuState(enabled);
    updateSqlSetting('hardware_gpu', enabled);
  };

  const setHardwareRam = (enabled: boolean) => {
    setHardwareRamState(enabled);
    updateSqlSetting('hardware_ram', enabled);
  };

  const setStartAtLogin = async (enabled: boolean) => {
    const oldState = startAtLogin;
    setStartAtLoginState(enabled); // Optimistic Update
    
    try {
      if (window.api?.toggleStartup) {
        const result = await window.api.toggleStartup(enabled);
        setStartAtLoginState(result);
        toast.success(result ? "Valis will start with Windows" : "Startup disabled");
      }
    } catch (error) {
      setStartAtLoginState(oldState); // Revert on failure
      toast.error("Failed to update startup settings");
      console.error('[Settings] Startup toggle failed:', error);
    }
  };

  return { 
    libraryAction, setLibraryAction,
    healthCheckEnabled, setHealthCheckEnabled,
    healthThreshold, setHealthThreshold,
    healthSound, setHealthSound,
    healthToast, setHealthToast,
    showDlc, setShowDlc,
    autoTrackingEnabled, autoTrackingInterval, setAutoTracking,
    museumMode, setMuseumMode,
    enableShardEffect, setEnableShardEffect,
    achievementToast, setAchievementToast,
    achievementSound, setAchievementSound,
    milestoneToast, setMilestoneToast,
    milestoneSound, setMilestoneSound,
    protocolToast, setProtocolToast,
    protocolSound, setProtocolSound,
    hardwareCpu, setHardwareCpu,
    hardwareGpu, setHardwareGpu,
    hardwareRam, setHardwareRam,
    startAtLogin, setStartAtLogin,
    isLoading
  };
};