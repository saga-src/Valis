
import React, { useState } from 'react';
import { AlertTriangle, Trash2, Check, Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({ isOpen, onClose }) => {
  const [options, setOptions] = useState({
    library: false,
    settings: false,
    accounts: false
  });
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const handleReset = async () => {
    if (!options.library && !options.settings && !options.accounts) return;

    setStatus('processing');
    try {
      if (window.api && window.api.factoryReset) {
        const result = await window.api.factoryReset(options);
        if (result.success) {
          setStatus('success');
          // Optional: Reload app after 2 seconds to reflect changes
          setTimeout(() => window.location.reload(), 2000);
        } else {
            setStatus('error');
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Factory Reset">
        <div className="space-y-6">
            {status === 'success' ? (
                <div className="text-center py-8 space-y-4">
                    <div className="bg-green-500/10 text-green-500 p-4 rounded-full w-fit mx-auto border border-green-500/20">
                        <Check size={32} />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-foreground">Reset Complete</p>
                        <p className="text-muted-foreground text-sm">Restarting application...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                        <AlertTriangle size={24} />
                        <p className="text-sm font-bold">This action cannot be undone.</p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Select the data you want to permanently erase:
                    </p>

                    <div className="space-y-3">
                        <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                            <input 
                                type="checkbox" 
                                className="mt-1 w-4 h-4 accent-destructive rounded"
                                checked={options.library}
                                onChange={(e) => setOptions({...options, library: e.target.checked})}
                            />
                            <div>
                                <span className="block text-sm font-bold text-foreground">Erase Library</span>
                                <span className="text-xs text-muted-foreground">Deletes all games, play sessions, achievements, and tags.</span>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                            <input 
                                type="checkbox" 
                                className="mt-1 w-4 h-4 accent-destructive rounded"
                                checked={options.settings}
                                onChange={(e) => setOptions({...options, settings: e.target.checked})}
                            />
                            <div>
                                <span className="block text-sm font-bold text-foreground">Reset Settings</span>
                                <span className="text-xs text-muted-foreground">Restores default preferences (themes, paths, configurations).</span>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                            <input 
                                type="checkbox" 
                                className="mt-1 w-4 h-4 accent-destructive rounded"
                                checked={options.accounts}
                                onChange={(e) => setOptions({...options, accounts: e.target.checked})}
                            />
                            <div>
                                <span className="block text-sm font-bold text-foreground">Unlink Accounts</span>
                                <span className="text-xs text-muted-foreground">Removes Steam/Epic/PSN links and clears login sessions.</span>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                        <button 
                            onClick={onClose}
                            disabled={status === 'processing'}
                            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        
                        <button 
                            onClick={handleReset}
                            disabled={status === 'processing' || (!options.library && !options.settings && !options.accounts)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm
                                ${(!options.library && !options.settings && !options.accounts) 
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                                    : 'bg-destructive text-white hover:bg-destructive/90 active:scale-95'
                                }
                            `}
                        >
                            {status === 'processing' ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            {status === 'processing' ? 'Erasing...' : 'Erase Selected Data'}
                        </button>
                    </div>
                </>
            )}
        </div>
    </Modal>
  );
};
