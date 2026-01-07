
import React, { ReactNode } from 'react';
import Modal from './Modal';
import { Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationModal({ 
  isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDanger = false, isLoading
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {typeof message === 'string' ? (
        <p className="text-muted-foreground mb-6">{message}</p>
      ) : (
        <div className="mb-6">{message}</div>
      )}
      <div className="flex justify-end gap-3">
        <button 
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 font-medium hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button 
          onClick={() => { 
            onConfirm(); 
            // Only auto-close if we are not in a controlled loading state
            // If isLoading prop is provided (not undefined), assume parent controls visibility
            if (isLoading === undefined) {
               onClose(); 
            }
          }}
          disabled={isLoading}
          className={`px-4 py-2 font-bold text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2 ${
            isDanger ? 'bg-destructive hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
          } ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
