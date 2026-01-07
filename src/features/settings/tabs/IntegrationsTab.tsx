import React, { useState, useEffect } from 'react';
import { Key, ShieldAlert, Save, Loader2, Link as LinkIcon, Gamepad2, RefreshCw, LogOut, Plus, User, Zap, Monitor, Info, Lightbulb, CircleHelp, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { WatchPathManager } from '../components/WatchPathManager';
import Modal from '../../../components/ui/Modal';
import IgdbGuideModal from '../components/IgdbGuideModal';
import PsnGuideModal from '../components/PsnGuideModal';
import { useSyncStore } from '../../../store/syncStore';
import { useMarkObserver } from '../../gamification/hooks/useMarkObserver';
import { useSocialBroadcast } from '../../social/hooks/useSocialBroadcast';

const AvatarCycler = ({ urlStr, alt }: { urlStr: string, alt: string }) => {
    const [index, setIndex] = React.useState(0);
    const urls = urlStr ? urlStr.split(';;;') : [];

    React.useEffect(() => {
        if (urls.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % urls.length);
        }, 3000); // 3 Seconds
        return () => clearInterval(timer);
    }, [urls.length]);

    if (urls.length === 0) return <User size={16} className="text-muted-foreground" />;

    return (
        <img 
            src={urls[index]} 
            alt={alt} 
            className="w-full h-full object-cover transition-opacity duration-500"
        />
    );
};

export const IntegrationsTab = () => {
  const { toast } = useToast();
  const { runSync, isSyncing: globalIsSyncing } = useSyncStore();
  const { reportSignal } = useMarkObserver();
  const { broadcastImport } = useSocialBroadcast();
  
  // State
  const [isTesting, setIsTesting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showIgdbHelp, setShowIgdbHelp] = useState(false);
  const [showPsnHelp, setShowPsnHelp] = useState(false);
  const [apiKeys, setApiKeys] = useState({ igdb_client_id: '', igdb_secret: '', steam_api_key: '', psn_npsso: '' });
  const [steamAccounts, setSteamAccounts] = useState<any[]>([]);
  const [epicAccounts, setEpicAccounts] = useState<any[]>([]);
  const [psnAccounts, setPsnAccounts] = useState<any[]>([]);
  const [xboxAccounts, setXboxAccounts] = useState<any[]>([]);
  
  // Loading States
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Modal State
  const [syncConfirmPlatform, setSyncConfirmPlatform] = useState<'steam' | 'epic' | 'psn' | 'xbox' | null>(null);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      if (window.api) {
        const [id, secret, steamKey, steamAccs, epicAccs, psnAccs, xboxAccs] = await Promise.all([
          window.api.getSetting('igdb_client_id'),
          window.api.getSetting('igdb_secret'),
          window.api.getSetting('steam_api_key'),
          window.api.getLinkedAccounts('steam'),
          window.api.getLinkedAccounts('epic'),
          window.api.getLinkedAccounts('psn'),
          window.api.getLinkedAccounts('xbox')
        ]);
        setApiKeys({
          igdb_client_id: id || '',
          igdb_secret: secret || '',
          steam_api_key: steamKey || '',
          psn_npsso: '' // Don't reload sensitive NPSSO, input is for new auth only
        });
        setSteamAccounts(steamAccs || []);
        setEpicAccounts(epicAccs || []);
        setPsnAccounts(psnAccs || []);
        setXboxAccounts(xboxAccs || []);
      }
    };
    loadData();
  }, []);

  // Monitor Sources for Marks
  useEffect(() => {
    const activeSources = [];
    if (steamAccounts.length > 0) activeSources.push('steam');
    if (epicAccounts.length > 0) activeSources.push('epic');
    if (psnAccounts.length > 0) activeSources.push('psn');
    if (xboxAccounts.length > 0) activeSources.push('xbox');
    
    reportSignal('SOURCE_UPDATE', activeSources);
  }, [steamAccounts, epicAccounts, psnAccounts, xboxAccounts, reportSignal]);

  const handleSave = async () => {
    try {
      if (window.api) {
        await Promise.all([
          window.api.saveSetting({ key: 'igdb_client_id', value: apiKeys.igdb_client_id }),
          window.api.saveSetting({ key: 'igdb_secret', value: apiKeys.igdb_secret }),
          window.api.saveSetting({ key: 'steam_api_key', value: apiKeys.steam_api_key })
        ]);
        toast.success('Settings saved successfully');
        setIsDirty(false);
      }
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleTestIGDB = async () => {
    setIsTesting(true);
    try {
      if (window.api) {
        const res = await window.api.testIgdbConnection(apiKeys.igdb_client_id, apiKeys.igdb_secret);
        if (res.success) {
          toast.success('IGDB Connection Successful!');
        } else {
          toast.error(`Connection Failed: ${res.error}`);
        }
      }
    } catch (e) {
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSteamAuth = async () => {
    setIsAuthLoading(true);
    try {
      if (window.api) {
        const res = await window.api.authSteam();
        if (res.success) {
          toast.success('Steam account connected!');
          const accounts = await window.api.getLinkedAccounts('steam');
          setSteamAccounts(accounts || []);
        } else {
          if (res.message !== 'Window closed by user') {
              toast.error(res.message || 'Authentication failed');
          }
        }
      }
    } catch (e) {
      toast.error('Steam login error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEpicAuth = async () => {
    setIsAuthLoading(true);
    try {
      if (window.api) {
        const res = await window.api.authEpic();
        if (res.success) {
          toast.success('Epic account connected!');
          const accounts = await window.api.getLinkedAccounts('epic');
          setEpicAccounts(accounts || []);
        } else {
          if (res.message !== 'Window closed') {
              toast.error(res.message || 'Authentication failed');
          }
        }
      }
    } catch (e) {
      toast.error('Epic login error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleXboxAuth = async () => {
    setIsAuthLoading(true);
    try {
      if (window.api) {
        const res = await window.api.authXbox();
        if (res.success) {
          toast.success('Xbox account connected!');
          const accounts = await window.api.getLinkedAccounts('xbox');
          setXboxAccounts(accounts || []);
        } else {
          // Suppress error if user closed the window
          if (res.error === 'Window closed by user') return;
          
          toast.error(res.error || 'Authentication failed');
        }
      }
    } catch (e: any) {
      // Suppress error if user closed the window (caught error case)
      if (e.message && e.message.includes('Window closed')) return;

      toast.error(`Xbox login error: ${e.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePsnAuth = async (manual = false) => {
    if (manual && !apiKeys.psn_npsso) {
        toast.error('Please enter your NPSSO code.');
        return;
    }
    
    setIsAuthLoading(true);
    try {
        if (!window.api) return;
        const res = await window.api.authPsn(manual ? apiKeys.psn_npsso : undefined);
        
        if (res.success) {
            toast.success('PSN account connected!');
            const accounts = await window.api.getLinkedAccounts('psn');
            setPsnAccounts(accounts || []);
            setApiKeys(prev => ({ ...prev, psn_npsso: '' }));
        } else {
            if (res.message !== 'Login cancelled') {
                toast.error(res.message || 'Authentication failed');
            }
        }
    } catch (e: any) {
        toast.error(`PSN Login Error: ${e.message}`);
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleUnlink = async (id: number, platform: 'steam' | 'epic' | 'psn' | 'xbox') => {
    try {
      if (window.api) {
        await window.api.unlinkAccount(id);
        if (platform === 'steam') setSteamAccounts(prev => prev.filter(acc => acc.id !== id));
        if (platform === 'epic') setEpicAccounts(prev => prev.filter(acc => acc.id !== id));
        if (platform === 'psn') setPsnAccounts(prev => prev.filter(acc => acc.id !== id));
        if (platform === 'xbox') setXboxAccounts(prev => prev.filter(acc => acc.id !== id));
        toast.success('Account unlinked');
      }
    } catch (e) {
      toast.error('Failed to unlink account');
    }
  };

  const requestSync = (platform: 'steam' | 'epic' | 'psn' | 'xbox') => {
      if (platform === 'steam' && !apiKeys.steam_api_key) {
          toast.error('Please save your Steam Web API Key first.');
          return;
      }
      setSyncConfirmPlatform(platform);
  };

  const executeSync = async (platform: 'steam' | 'epic' | 'psn' | 'xbox') => {
    if (!window.api) return;

    let syncPromise;
    if (platform === 'steam') syncPromise = window.api.syncSteamLibrary();
    else if (platform === 'epic') syncPromise = window.api.syncEpicLibrary();
    else if (platform === 'psn') syncPromise = window.api.syncPsnLibrary();
    else if (platform === 'xbox') syncPromise = window.api.syncXboxLibrary();

    try {
        const res = await runSync(syncPromise);
        
        if (res && res.success) {
            const count = res.added || 0;
            
            toast.success(`Sync complete! Added ${count} games.`);
            reportSignal('IMPORT_LIBRARY');

            // Broadcast Import Summary if games were added
            if (count > 0) {
                // Determine source name for display
                const sourceNames = {
                    steam: 'Steam',
                    epic: 'Epic Games',
                    psn: 'PlayStation',
                    xbox: 'Xbox'
                };
                
                // Calculate hours from minutes (if available)
                let hours = 0;
                if (res.playtimeMinutes) {
                    hours = Math.round(res.playtimeMinutes / 60);
                }

                broadcastImport(sourceNames[platform], count, hours);
            }
        } else {
            toast.error(res?.error || 'Sync failed');
        }
    } catch (e) {
        toast.error('Sync process error');
    }
  };

  const AccountList = ({ accounts, platform }: { accounts: any[], platform: 'steam' | 'epic' | 'psn' | 'xbox' }) => (
    <div className="space-y-2 mb-4">
        {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                        <AvatarCycler urlStr={acc.avatar_url} alt={acc.username || `${platform} User`} />
                    </div>
                    <div>
                        <div className="text-sm font-bold">{acc.username || `${platform} User`}</div>
                        <div className="text-[10px] text-muted-foreground">ID: {acc.external_id}</div>
                    </div>
                </div>
                <button 
                    onClick={() => handleUnlink(acc.id, platform)}
                    className="text-muted-foreground hover:text-destructive p-2 hover:bg-destructive/10 rounded-md transition-colors"
                    title="Unlink Account"
                >
                    <LogOut size={16} />
                </button>
            </div>
        ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex flex-col gap-2 mb-2">
            <h2 className="text-2xl font-bold">Integrations</h2>
            <p className="text-muted-foreground">Connect external services to enrich your library.</p>
        </div>

        {/* IGDB Configuration */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gamepad2 size={20} className="text-primary" /> IGDB Metadata
            </h2>
            
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border/50">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-muted-foreground font-medium">
                Powered by Valis Cloud. Game metadata and cover art fetching is active.
              </span>
            </div>
        </div>

        {/* Steam Integration */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <LinkIcon size={20} className="text-blue-500" /> Steam Sync
            </h2>
            
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold mb-3">Linked Accounts</h3>
                    {steamAccounts.length > 0 ? (
                        <AccountList accounts={steamAccounts} platform="steam" />
                    ) : (
                        <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center text-sm text-muted-foreground mb-4">
                            No Steam accounts linked. Connect to import library.
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={handleSteamAuth}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-[#171a21] hover:bg-[#2a475e] text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Connect Steam
                        </button>
                        
                        {steamAccounts.length > 0 && (
                            <button 
                                id="btn-sync-steam"
                                onClick={() => requestSync('steam')}
                                disabled={globalIsSyncing}
                                className="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 ml-auto"
                            >
                                <RefreshCw size={16} />
                                Sync Library
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/50">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Key size={12} /> Steam Web API Key
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="password"
                            value={apiKeys.steam_api_key}
                            onChange={(e) => { setApiKeys({...apiKeys, steam_api_key: e.target.value}); setIsDirty(true); }}
                            className="flex-1 bg-background border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Enter your Steam API Key..."
                        />
                        <button 
                            onClick={handleSave}
                            disabled={!isDirty}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 font-bold text-sm"
                        >
                            <Save size={16} />
                            Save
                        </button>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-600 dark:text-amber-500 leading-normal">
                           <strong>Required for Sync:</strong> 
                           <span className="ml-1">
                               You must provide a Web API Key to fetch your Games, Avatar, and Username. 
                               <button 
                                   onClick={() => window.api.openSteamApiKeyPage()} 
                                   className="ml-1 text-primary hover:text-primary/80 font-bold underline bg-transparent border-none p-0 cursor-pointer"
                               >
                                   Get API Key
                               </button>
                           </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Xbox Integration */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Monitor size={20} className="text-green-600" /> Xbox Network
            </h2>
            
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold mb-3">Linked Accounts</h3>
                    {xboxAccounts.length > 0 ? (
                        <AccountList accounts={xboxAccounts} platform="xbox" />
                    ) : (
                        <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center text-sm text-muted-foreground mb-4">
                            No Xbox accounts linked.
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={handleXboxAuth}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-[#107C10] hover:bg-[#0b5c0b] text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Connect Xbox
                        </button>
                        
                        {xboxAccounts.length > 0 && (
                            <button 
                                id="btn-sync-xbox"
                                onClick={() => requestSync('xbox')}
                                disabled={globalIsSyncing}
                                className="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 ml-auto"
                            >
                                <RefreshCw size={16} />
                                Sync Library
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-3 bg-muted/50 border border-border rounded-md flex gap-3 items-start">
                    <Info className="shrink-0 text-muted-foreground mt-0.5" size={16} />
                    <div className="text-xs text-muted-foreground">
                        <strong className="block text-foreground mb-1">API Limitation</strong>
                        Xbox Sync only retrieves <strong>Achievements</strong>. Legacy playtime (hours played before using Valis) cannot be imported via API and will start at 0.
                    </div>
                </div>
            </div>
        </div>

        {/* Epic Games Integration */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap size={20} className="text-gray-200 fill-black" /> Epic Games Sync
            </h2>
            
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold mb-3">Linked Accounts</h3>
                    {epicAccounts.length > 0 ? (
                        <AccountList accounts={epicAccounts} platform="epic" />
                    ) : (
                        <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center text-sm text-muted-foreground mb-4">
                            No Epic accounts linked.
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={handleEpicAuth}
                            disabled={isAuthLoading}
                            className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Connect Epic Account
                        </button>
                        
                        {epicAccounts.length > 0 && (
                            <button 
                                id="btn-sync-epic"
                                onClick={() => requestSync('epic')}
                                disabled={globalIsSyncing}
                                className="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 ml-auto"
                            >
                                <RefreshCw size={16} />
                                Sync Library
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 flex items-start gap-2">
                    <span className="text-lg leading-none">⚠️</span> 
                    <span>
                      <strong>Note:</strong> The Epic Games sync uses a visual scraper. Some less-known games or 
                      uncommon achievement titles may occasionally mismatch or fail to sync correctly.
                    </span>
                  </p>
                </div>
            </div>
        </div>

        {/* PlayStation Network Integration */}
        <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gamepad2 size={20} className="text-blue-700" /> PlayStation Network
            </h2>
            
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold mb-3">Linked Accounts</h3>
                    {psnAccounts.length > 0 ? (
                        <AccountList accounts={psnAccounts} platform="psn" />
                    ) : (
                        <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center text-sm text-muted-foreground mb-4">
                            No PSN accounts linked.
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <h4 className="text-sm font-bold flex items-center gap-2 text-blue-500">
                                <ShieldAlert size={16} /> 
                                Connection Setup
                            </h4>
                            
                            <p className="text-xs text-muted-foreground">
                                Due to Sony's new security (Passkeys), you must login via your browser for manual token extraction.
                                <button 
                                    onClick={() => setShowPsnHelp(true)}
                                    className="ml-1 text-primary hover:underline font-bold inline-flex items-center gap-1"
                                >
                                    How to get token <CircleHelp className="w-3 h-3" />
                                </button>
                            </p>

                            <div className="flex gap-2 items-center mt-3 -ml-1">
                                <div className="relative flex-1">
                                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input 
                                        type="password"
                                        value={apiKeys.psn_npsso}
                                        onChange={(e) => setApiKeys({...apiKeys, psn_npsso: e.target.value})}
                                        className="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Paste the 'npsso' code here..."
                                    />
                                </div>
                                <button 
                                    onClick={() => handlePsnAuth(true)}
                                    disabled={isAuthLoading || !apiKeys.psn_npsso}
                                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : 'Connect'}
                                </button>
                            </div>
                        </div>

                        {psnAccounts.length > 0 && (
                            <div className="flex justify-end">
                                <button 
                                    id="btn-sync-psn"
                                    onClick={() => requestSync('psn')}
                                    disabled={globalIsSyncing}
                                    className="px-4 py-2 border border-primary/50 text-primary hover:bg-primary/5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 ml-auto"
                                >
                                    <RefreshCw size={16} />
                                    Sync Library
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-3 bg-muted/50 border border-border rounded-md flex gap-3 items-start">
                    <Info className="shrink-0 text-muted-foreground mt-0.5" size={16} />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-yellow-500 font-bold">⚠️ Note:</span> To fetch achievements for PlayStation exclusives (like Bloodborne or God of War), you must link your account here. The app scans your 'Played Games' history to find matches.
                    </div>
                </div>
            </div>
        </div>

        {/* Watch Path Manager */}
        <WatchPathManager />
        
        {/* Sync Confirmation Modal */}
        <Modal isOpen={!!syncConfirmPlatform} onClose={() => setSyncConfirmPlatform(null)} title="Sync Library">
            <div className="space-y-6">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex gap-4 items-start">
                    <Lightbulb className="shrink-0 text-primary mt-0.5" size={24} />
                    <div className="text-sm">
                        <strong className="block text-primary mb-2 text-base">Recommendation</strong>
                        <p className="text-muted-foreground leading-relaxed">
                            You should only Sync your Library <strong>once</strong> (when first logging in) to fetch your legacy history. 
                        </p>
                        <p className="text-muted-foreground leading-relaxed mt-2">
                            For daily usage, the app tracks playtime automatically. Frequent syncing is not necessary and may overwrite manual changes.
                        </p>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                    <button 
                        onClick={() => setSyncConfirmPlatform(null)} 
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors text-foreground"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            if (syncConfirmPlatform) executeSync(syncConfirmPlatform);
                            setSyncConfirmPlatform(null);
                        }} 
                        className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-all shadow-sm active:scale-95"
                    >
                        Start Sync
                    </button>
                </div>
            </div>
        </Modal>

        {/* IGDB Guide Modal */}
        <IgdbGuideModal isOpen={showIgdbHelp} onClose={() => setShowIgdbHelp(false)} />
        {/* PSN Guide Modal */}
        <PsnGuideModal isOpen={showPsnHelp} onClose={() => setShowPsnHelp(false)} />
    </div>
  );
};