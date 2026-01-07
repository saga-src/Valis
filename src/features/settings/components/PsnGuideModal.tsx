
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';

interface PsnGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PsnGuideModal({ isOpen, onClose }: PsnGuideModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Card Container */}
      <div className="relative bg-card border border-border max-w-lg w-full p-6 rounded-xl shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">PlayStation Network Setup</h2>
            <p className="text-sm text-muted-foreground mt-1">Manually retrieve your authentication token.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Step 1 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">1</div>
            <div className="pt-1">
              <p className="text-sm font-medium">
                Open the <a href="https://www.playstation.com/" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 text-primary">PlayStation Login Page <ExternalLink size={12}/></a> in your browser and sign in.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">2</div>
            <div className="pt-1">
              <p className="text-sm font-medium">
                Once logged in, open the <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 text-primary">Token Page <ExternalLink size={12}/></a> to reveal your session data.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">3</div>
            <div className="pt-1">
              <p className="text-sm font-medium mb-2">You will see a JSON response. Look for the <code className="bg-muted font-mono px-1 rounded text-foreground">npsso</code> field.</p>
              <div className="p-3 bg-muted rounded-lg border border-border font-mono text-xs text-muted-foreground break-all">
                {`{"npsso": "abc123..."}`}
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">4</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Copy the 64-character code inside the quotes and paste it into Valis.</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border flex justify-end">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg transition-colors"
            >
                Got it
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
