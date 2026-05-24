import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { RELEASE_NOTES } from '../../data/releaseNotes';
import { Check } from 'lucide-react';
import * as Icons from 'lucide-react';

const ReleaseIcon = ({ name }: { name?: string }) => {
  const Icon = name && (Icons as any)[name] ? (Icons as any)[name] : Icons.Sparkles;
  return <Icon size={18} />;
};

export const UpdateNotesModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      if (window.api && window.api.getMeta) {
        const lastVersion = await window.api.getMeta('valis_last_version');
        if (lastVersion !== RELEASE_NOTES.version) {
          setIsOpen(true);
        }
      }
    };
    checkVersion();
  }, []);

  const handleClose = async () => {
    if (window.api && window.api.setMeta) {
      await window.api.setMeta('valis_last_version', RELEASE_NOTES.version);
    }
    setIsOpen(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`What's New in v${RELEASE_NOTES.version}: ${RELEASE_NOTES.title}`}>
      <div className="space-y-6">
        <div className="space-y-4">
          {RELEASE_NOTES.features.map((feature, index) => (
            <div key={index} className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <ReleaseIcon name={feature.icon} />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-bold text-foreground">
                  {feature.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t">
          <button 
            onClick={handleClose}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-[0.98]"
          >
            <Check size={18} />
            Got it!
          </button>
        </div>
      </div>
    </Modal>
  );
};
