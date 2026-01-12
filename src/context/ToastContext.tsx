
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils/cn';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    console.log('🛡️ ToastProvider mounted');
    return () => console.log('🛡️ ToastProvider unmounted');
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    console.log('🍞 Toast requested:', { message, type });
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const contextValue = {
    toast: {
      success: (msg: string) => addToast(msg, 'success'),
      error: (msg: string) => addToast(msg, 'error'),
      info: (msg: string) => addToast(msg, 'info'),
    },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container (Fixed Overlay) */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-xl border flex items-start gap-3 animate-in slide-in-from-right-full duration-300 bg-background/95 backdrop-blur-sm",
              t.type === 'success' && "border-green-500/50 text-foreground",
              t.type === 'error' && "bg-destructive text-destructive-foreground border-destructive",
              t.type === 'info' && "border-border text-foreground"
            )}
          >
            <div className="mt-0.5 shrink-0">
                {t.type === 'success' && <CheckCircle2 className="text-green-500" size={18} />}
                {t.type === 'error' && <AlertCircle className="text-white" size={18} />}
                {t.type === 'info' && <Info className="text-blue-500" size={18} />}
            </div>
            
            <p className="text-sm font-medium flex-1 leading-tight">{t.message}</p>
            
            <button 
              onClick={() => removeToast(t.id)}
              className="opacity-50 hover:opacity-100 transition-opacity -mr-1 -mt-1 p-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
