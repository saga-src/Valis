
import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  title?: string;
}

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-xl bg-card border shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {title && (
          <div className="border-b px-6 py-4 flex justify-between items-center bg-muted/20 shrink-0 backdrop-blur-md">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}