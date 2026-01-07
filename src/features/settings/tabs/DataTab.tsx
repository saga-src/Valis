import React, { useState } from 'react';
import { Database, FileSpreadsheet, Trash2, AlertCircle, RefreshCw, Archive, RotateCcw, Trophy } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import Modal from '../../../components/ui/Modal';
import { FactoryResetModal } from '../components/FactoryResetModal';
import { useMarkObserver } from '../../gamification/hooks/useMarkObserver';

export const DataTab = () => {
  const { toast } = useToast();
  const { reportSignal } = useMarkObserver();
  
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'reset' | 'import' | 'success' | null>(null);
  const [refreshStatus, setRefreshStatus] = useState({ current: 0, total: 0, name: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [achRefreshStatus, setAchRefreshStatus] = useState({ current: 0, total: 0, name: '' });
  const [isAchRefreshing, setIsAchRefreshing] = useState(false);

  const handleAction = async (action: () => Promise<any>, successMsg: string) => {
    setLoading(true);
    try {
      const result = await action();
      if (result) {
          toast.success(successMsg);
          setActiveModal('success');
          // Signal Import Success
          reportSignal('IMPORT_LIBRARY');
      }
    } catch { toast.error('Operation failed'); } 
    finally { setLoading(false); }
  };

  const handleExcel = async (op: 'import' | 'export') => {
    setLoading(true);
    try {
        const res = op === 'import' ? await window.api.importSessionsExcel() : await window.api.exportSessionsExcel();
        if (res.success) {
            toast.success(res.message || 'Success!');
            if (op === 'import') reportSignal('IMPORT_LIBRARY');
        }
        else if (res.message !== 'Cancelled') toast.error(res.message);
    } catch { toast.error('Excel error'); } 
    finally { setLoading(false); }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const removeListener = window.api.onMetadataProgress((d: any) => setRefreshStatus({ current: d.current, total: d.total, name: d.gameName }));
    try {
      const res = await window.api.refreshMetadata({ forceAll: false });
      res.success ? toast.success(`Updated ${res.count} games!`) : toast.error(res.error);
    } catch { toast.error('Update failed'); } 
    finally { removeListener(); setIsRefreshing(false); }
  };

  const handleAchievementRefresh = async () => {
    setIsAchRefreshing(true);
    toast.info('Starting achievement metadata update...');

    // Listen for progress from Electron
    const removeListener = window.api.onAchievementsRefreshProgress((d: any) => {
        setAchRefreshStatus({ current: d.current, total: d.total, name: d.gameName });
    });

    try {
      const res = await window.api.refreshAchievementsMetadata();
      if (res.success) {
        toast.success(`Finished! Processed ${res.processed} games.`);
      } else {
        toast.error(`Update failed: ${res.error}`);
      }
    } catch (e: any) {
        toast.error(`Error: ${e.message}`);
    } finally {
      removeListener(); // Clean up listener
      setIsAchRefreshing(false);
      setAchRefreshStatus({ current: 0, total: 0, name: '' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-bold">Data Management</h2>
        <p className="text-muted-foreground">Backup, restore, and maintain your library data.</p>
      </div>

      {/* Maintenance */}
      <div className="p-6 border rounded-xl bg-card transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2"><Database size={20} className="text-primary" /> Backups</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Archive size={12} /> Full System (JSON)
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => handleAction(window.api.exportData, 'Backup created')} disabled={loading} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">Export All</button>
                    <button onClick={() => setActiveModal('import')} disabled={loading} className="flex-1 py-2.5 border border-border text-foreground rounded-lg font-bold text-sm hover:bg-muted disabled:opacity-50 transition-all">Import All</button>
                </div>
            </div>
            <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <FileSpreadsheet size={12} /> Sessions (Excel)
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => handleExcel('export')} disabled={loading} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex-1 flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-900/20 disabled:opacity-50"><FileSpreadsheet size={16}/> Export</button>
                    <button onClick={() => handleExcel('import')} disabled={loading} className="px-4 py-2.5 border border-emerald-600/30 text-emerald-600 hover:bg-emerald-600/10 rounded-lg font-bold flex-1 flex items-center justify-center gap-2 transition-all disabled:opacity-50"><FileSpreadsheet size={16}/> Import</button>
                </div>
            </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-border/50">
            {/* Library Metadata Refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-bold text-sm">Update Library Metadata</p>
                    <p className="text-xs text-muted-foreground">Refresh covers and info from IGDB</p>
                </div>
                <button onClick={handleRefresh} disabled={isRefreshing} className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-lg text-sm hover:bg-secondary/80 flex items-center gap-2">
                    {isRefreshing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {isRefreshing ? `Updating (${refreshStatus.current}/${refreshStatus.total})` : 'Refresh IGDB'}
                </button>
            </div>

            {/* Achievement Metadata Refresh */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                    <p className="font-bold text-sm">Update Achievement Data</p>
                    <p className="text-xs text-muted-foreground">Scrape Steam for new icons and descriptions</p>
                </div>
                <button onClick={handleAchievementRefresh} disabled={isAchRefreshing} className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-lg text-sm hover:bg-secondary/80 flex items-center gap-2 min-w-[160px] justify-center">
                    {isAchRefreshing ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                    {isAchRefreshing ? `${achRefreshStatus.current}/${achRefreshStatus.total}` : 'Refresh Steam'}
                </button>
            </div>
            {isAchRefreshing && achRefreshStatus.name && (
                <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                    Currently checking: <span className="font-bold text-primary">{achRefreshStatus.name}</span>
                </p>
            )}
        </div>
    </div>

      {/* Danger Zone */}
      <div className="p-6 border border-destructive/30 rounded-xl bg-destructive/5 transition-all hover:bg-destructive/10">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive"><AlertCircle size={20} /> Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-6">Wipe local data. This cannot be undone.</p>
        <button onClick={() => setActiveModal('reset')} disabled={loading} className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-destructive/20"><Trash2 size={18} /> Factory Reset</button>
      </div>

      {/* Modals */}
      <FactoryResetModal isOpen={activeModal === 'reset'} onClose={() => setActiveModal(null)} />
      <ConfirmationModal isOpen={activeModal === 'import'} onClose={() => setActiveModal(null)} onConfirm={() => handleAction(window.api.importData, 'Restore Complete')} title="Restore Backup" message="Overwrite current library?" confirmText="Restore" isDanger />
      
      <Modal isOpen={activeModal === 'success'} onClose={() => window.location.reload()} title="Complete">
        <div className="text-center p-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Restart Required</h3>
            <p className="text-muted-foreground mb-6">Data operation successful. The application needs to reload to apply changes.</p>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:opacity-90 transition-all">Reload App</button>
        </div>
      </Modal>
    </div>
  );
};