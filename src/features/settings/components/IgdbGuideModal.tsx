
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';

interface IgdbGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IgdbGuideModal({ isOpen, onClose }: IgdbGuideModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Card Container */}
      <div className="relative bg-card border border-border max-w-lg w-full p-6 rounded-xl shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">How to get IGDB API Keys</h2>
            <p className="text-sm text-muted-foreground mt-1">Follow these steps to connect your library.</p>
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
              <p className="text-sm font-medium">Sign Up with <a href="https://www.twitch.tv/" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 text-primary">Twitch <ExternalLink size={12}/></a> for a free account.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">2</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Ensure Two Factor Authentication is <a href="https://www.twitch.tv/settings/security" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 text-primary">enabled <ExternalLink size={12}/></a>.</p>
              <p className="text-xs text-muted-foreground mt-1">Required to register applications.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">3</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Register your app in the <a href="https://dev.twitch.tv/console" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 text-primary">Twitch Developer Portal <ExternalLink size={12}/></a>.</p>
              <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-2">
                <div className="flex gap-2 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span><strong>OAuth Redirect URL:</strong> Enter <code>http://localhost</code></span>
                </div>
                <div className="flex gap-2 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span><strong>Client Type:</strong> Select <code>Confidential</code></span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">4</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Click <span className="font-bold text-foreground">Manage</span> on your new app.</p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">5</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Generate a Client Secret by pressing <span className="font-bold text-foreground">New Secret</span>.</p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground">6</div>
            <div className="pt-1">
              <p className="text-sm font-medium">Copy the <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 px-1 rounded">Client ID</span> and <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 px-1 rounded">Client Secret</span> into Valis.</p>
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
