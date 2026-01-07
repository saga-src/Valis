
import React, { useState, useEffect } from 'react';
import { FolderSearch, Trash2, Plus, AlertCircle, FolderOpen, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface WatchPath {
  id: number;
  path: string;
  type: 'goldberg' | 'codex';
  recursive: number;
}

export const WatchPathManager: React.FC = () => {
  const [paths, setPaths] = useState<WatchPath[]>([]);
  const [newPath, setNewPath] = useState('');
  const [newType, setNewType] = useState<'goldberg' | 'codex'>('goldberg');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [pathExists, setPathExists] = useState<boolean | null>(null);

  const loadPaths = async () => {
    try {
      if (window.api?.getWatchPaths) {
        const data = await window.api.getWatchPaths();
        setPaths(data);
      }
    } catch (e) {
      console.error("Failed to load watch paths", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaths();
  }, []);

  // Verify path existence when user stops typing
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!newPath.trim()) {
        setPathExists(null);
        return;
      }
      setVerifying(true);
      try {
        if (window.api?.checkPathExists) {
            const exists = await window.api.checkPathExists(newPath);
            setPathExists(exists);
        }
      } catch {
        setPathExists(false);
      } finally {
        setVerifying(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newPath]);

  const handleAdd = async () => {
    if (!newPath.trim()) return;
    setLoading(true);
    try {
      if (window.api?.addWatchPath) {
        await window.api.addWatchPath(newPath, newType);
        await loadPaths();
        setNewPath('');
        setPathExists(null);
      }
    } catch (e) {
      console.error("Failed to add path", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
        if (window.api?.removeWatchPath) {
            await window.api.removeWatchPath(id);
            setPaths(prev => prev.filter(p => p.id !== id));
        }
    } catch (e) {
        console.error("Failed to remove path", e);
    }
  };

  return (
    <div className="p-6 border rounded-xl bg-card shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-6">
        <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
                <FolderSearch size={22} className="text-primary" /> Achievement Sources
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
                Manage directories monitored for achievement unlocks. Supports <code>%APPDATA%</code> variables.
            </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* List */}
        <div className="border rounded-lg overflow-hidden bg-background">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/50 border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-8">Directory Path</div>
                <div className="col-span-3">Emulator Type</div>
                <div className="col-span-1 text-right">Action</div>
            </div>
            
            {paths.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">
                    No paths configured. Add a save folder below.
                </div>
            ) : (
                <div className="divide-y">
                    {paths.map(path => (
                        <div key={path.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm group hover:bg-muted/20 transition-colors">
                            <div className="col-span-8 font-mono truncate text-xs" title={path.path}>
                                {path.path}
                            </div>
                            <div className="col-span-3">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                    path.type === 'goldberg' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                )}>
                                    {path.type}
                                </span>
                            </div>
                            <div className="col-span-1 text-right">
                                <button 
                                    onClick={() => handleRemove(path.id)}
                                    className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Add New */}
        <div className="flex flex-col md:flex-row gap-3 pt-2">
            <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <FolderOpen size={16} />
                </div>
                <input 
                    type="text" 
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="%APPDATA%\Goldberg SteamEmu Saves"
                    className={cn(
                        "w-full pl-10 pr-10 py-2.5 bg-background border rounded-lg text-sm outline-none focus:ring-2 transition-all font-mono",
                        pathExists === true ? "focus:ring-green-500/50 border-green-500/30" : 
                        pathExists === false ? "focus:ring-red-500/50 border-red-500/30" : 
                        "focus:ring-primary border-border"
                    )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {verifying ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : pathExists === true ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                    ) : pathExists === false ? (
                        <AlertCircle size={16} className="text-red-500" />
                    ) : null}
                </div>
            </div>

            <div className="w-full md:w-40 shrink-0">
                <select 
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full h-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="goldberg">Goldberg (JSON)</option>
                    <option value="codex">CODEX (INI)</option>
                </select>
            </div>

            <button 
                onClick={handleAdd}
                disabled={!newPath || loading}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shrink-0"
            >
                <Plus size={18} /> Add
            </button>
        </div>
        {pathExists === false && (
            <p className="text-[10px] text-destructive flex items-center gap-1.5 pl-1">
                <AlertCircle size={10} />
                Path does not exist or cannot be accessed. Environment variables are supported (e.g. %APPDATA%).
            </p>
        )}
      </div>
    </div>
  );
};
