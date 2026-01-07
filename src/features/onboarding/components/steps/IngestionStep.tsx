import React, { useState, useEffect } from 'react';
import { useToast } from '../../../../context/ToastContext';
import { Loader2, CheckCircle2, Monitor, Gamepad2, Zap, Layout } from 'lucide-react';
import { cn } from '../../../../lib/utils/cn';

export const IngestionStep: React.FC = () => {
  const { toast } = useToast();
  const [steamKey, setSteamKey] = useState('');
  const [linkedPlatforms, setLinkedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchLinked = async () => {
    if (!window.api) return;
    const platforms = ['steam', 'epic', 'psn', 'xbox'];
    try {
        const results = await Promise.all(platforms.map(p => window.api.getLinkedAccounts(p)));
        const connected = platforms.filter((_, i) => results[i] && results[i].length > 0);
        setLinkedPlatforms(connected);
    } catch (e) {
        console.error('[Onboarding] Failed to fetch linked accounts:', e);
    }
  };

  useEffect(() => {
    fetchLinked();
  }, []);

  const isConnected = (p: string) => linkedPlatforms.includes(p);

  const handleSteamConnect = async () => {
    if (!steamKey.trim()) return;
    setLoading('steam');
    try {
      await window.api.saveSetting({ key: 'steam_api_key', value: steamKey });
      const res = await window.api.authSteam();
      if (res.success) {
        toast.success("Steam Connected");
        fetchLinked();
      } else {
        if (res.message !== 'Window closed by user') {
            toast.error(res.message || "Failed to connect Steam");
        }
      }
    } catch (e) {
      toast.error("Steam connection error");
    } finally {
      setLoading(null);
    }
  };

  const handleGenericConnect = async (platform: 'epic' | 'xbox' | 'psn') => {
    setLoading(platform);
    try {
      let res;
      if (platform === 'epic') res = await window.api.authEpic();
      else if (platform === 'xbox') res = await window.api.authXbox();
      else if (platform === 'psn') res = await window.api.authPsn();

      if (res && (res.success || res.username)) {
        toast.success(`${platform.toUpperCase()} Connected`);
        fetchLinked();
      }
    } catch (e: any) {
      if (e.message !== 'Window closed' && e.message !== 'USER_CLOSED_WINDOW') {
          toast.error(`${platform} connection error`);
      }
    } finally {
      setLoading(null);
    }
  };

  const Card = ({ id, label, icon: Icon, onConnect, children }: any) => {
    const connected = isConnected(id);
    const isLoading = loading === id;

    return (
      <div className={cn(
        "p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-3 relative overflow-hidden",
        connected 
          ? "bg-emerald-500/5 border-emerald-500/30" 
          : "bg-zinc-800/50 border-white/5 hover:border-white/10"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg bg-zinc-900/50", connected ? "text-emerald-400" : "text-zinc-400")}>
                <Icon size={16} />
            </div>
            <span className="font-bold text-sm text-white">{label}</span>
          </div>
          {connected && <CheckCircle2 size={16} className="text-emerald-500" />}
        </div>

        <div className="flex-1">
          {connected ? (
            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider mt-1">Authorized</p>
          ) : (
            children || (
              <button
                disabled={!!loading}
                onClick={onConnect}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white border border-white/5"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : "Link Account"}
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4 mt-2">
      <Card id="steam" label="Steam" icon={Layout}>
        <div className="space-y-2">
          <input
            type="password"
            placeholder="Web API Key"
            value={steamKey}
            onChange={(e) => setSteamKey(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-primary/50 text-white"
          />
          <button
            disabled={!!loading || !steamKey}
            onClick={handleSteamConnect}
            className="w-full py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center border border-primary/20"
          >
            {loading === 'steam' ? <Loader2 size={12} className="animate-spin" /> : "Connect"}
          </button>
          <div className="text-[10px] text-muted-foreground mt-1 text-center">
            Need a key? 
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    window.api.openSteamApiKeyPage();
                }}
                className="ml-1 text-emerald-400 hover:underline font-bold"
            >
                Open Steam Dev Page
            </button>
          </div>
        </div>
      </Card>
      
      <Card id="xbox" label="Xbox" icon={Monitor} onConnect={() => handleGenericConnect('xbox')} />
      <Card id="psn" label="PlayStation" icon={Gamepad2} onConnect={() => handleGenericConnect('psn')} />
      <Card id="epic" label="Epic Games" icon={Zap} onConnect={() => handleGenericConnect('epic')} />
    </div>
  );
};