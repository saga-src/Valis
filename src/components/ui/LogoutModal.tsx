import React from 'react';
import { createPortal } from 'react-dom'; // <--- NEW IMPORT
import { LogOut, Loader2, ShieldCheck } from 'lucide-react'; // Switched icon to Shield for "Safety" vibe

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSyncing: boolean;
}

export const LogoutModal = ({ isOpen, onClose, onConfirm, isSyncing }: LogoutModalProps) => {
  if (!isOpen) return null;

  // Use Portal to render this at the very top of the DOM tree (document.body)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Content */}
      <div className="bg-card border border-border w-full max-w-sm rounded-xl p-6 shadow-2xl space-y-6 mx-4 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            {isSyncing ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
          </div>
          <h2 className="text-xl font-bold">Disconnect Account?</h2>
          <p className="text-sm text-muted-foreground">
            {isSyncing 
              ? "Syncing your latest changes to the cloud..." 
              : "We will save your progress to the cloud before logging you out."}
          </p>
        </div>

        {/* Warning Note (Updated Text) */}
        {!isSyncing && (
          <div className="bg-muted/50 p-3 rounded-lg flex gap-3 items-start text-xs text-muted-foreground text-left">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>Local data will be cleared from this device for your security.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            disabled={isSyncing}
            className="flex-1 py-2.5 rounded-lg font-semibold hover:bg-muted transition-colors disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isSyncing}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isSyncing ? 'Syncing...' : 'Confirm Logout'}
          </button>
        </div>

      </div>
    </div>,
    document.body // <--- Renders outside the current DOM hierarchy
  );
};