
import React, { useState } from 'react';
import { Cloud, Mail, Lock, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils/cn';

interface AuthWidgetProps {
  onSuccess?: () => void;
  variant?: 'card' | 'modal';
  className?: string;
}

export const AuthWidget: React.FC<AuthWidgetProps> = ({ onSuccess, variant = 'card', className }) => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isLoginMode) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        toast.success('Account created! Please check your email.');
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <div className={cn(
      "p-8 border rounded-xl bg-card shadow-sm w-full",
      variant === 'modal' ? "max-w-md animate-in zoom-in-95 duration-200" : "",
      className
    )}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Cloud size={24} className="text-primary" />
          {isLoginMode ? 'Sign In' : 'Create Account'}
        </h3>
        <button 
          type="button" 
          onClick={() => { setIsLoginMode(!isLoginMode); setErrorMsg(null); }}
          className="text-xs font-bold text-primary hover:underline"
        >
          {isLoginMode ? 'Need an account?' : 'Already have one?'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLoginMode && (
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Username</label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="unique_username"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-destructive text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (isLoginMode ? 'Sign In' : 'Sign Up')}
        </button>
      </form>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        {formContent}
      </div>
    );
  }

  return formContent;
};
