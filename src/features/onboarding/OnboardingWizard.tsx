
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/cloud/supabase';
import { useToast } from '../../context/ToastContext';
import { Camera, Gamepad2, Sword, Target, Clock, Users, ArrowRight, Check } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

const PLAYSTYLES = [
  { id: 'Casual', icon: Gamepad2, label: 'Casual', desc: 'I play for fun & relaxation' },
  { id: 'Hardcore', icon: Sword, label: 'Hardcore', desc: 'I love a challenge' },
  { id: 'Completionist', icon: Target, label: 'Completionist', desc: 'I need that 100%' },
  { id: 'Speedrunner', icon: Clock, label: 'Speedrunner', desc: 'Gotta go fast' },
  { id: 'Social', icon: Users, label: 'Social', desc: 'Here for the friends' },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState(profile?.username || '');
  const [bio, setBio] = useState('');
  const [playstyle, setPlaystyle] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const finishOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    toast.info("Creating your profile...");

    try {
      let avatarPath = profile?.avatar_url || '';

      // 1. Upload Avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarPath = data.publicUrl;
      }

      // 2. Update Profile
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio,
          playstyle,
          avatar_url: avatarPath,
          onboarding_complete: true // <--- IMPORTANT
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Welcome to Valis!");
      onComplete(); // Trigger app refresh
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-8 bg-card border border-border p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <div 
                className="h-full bg-primary transition-all duration-500 ease-out" 
                style={{ width: step === 1 ? '50%' : '100%' }}
            />
        </div>

        {/* Step 1: Identity */}
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black tracking-tight">Who are you?</h1>
                <p className="text-muted-foreground font-medium">Let's set up your gamer identity.</p>
            </div>
            
            {/* Avatar Upload */}
            <div className="relative w-32 h-32 mx-auto group cursor-pointer">
              <input type="file" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 z-10 cursor-pointer" accept="image/*" />
              <div className={cn(
                  "w-full h-full rounded-full overflow-hidden border-4 transition-all duration-300 flex items-center justify-center bg-muted",
                  previewUrl ? "border-primary" : "border-dashed border-muted-foreground/30 group-hover:border-primary/50"
              )}>
                  {previewUrl ? (
                      <img src={previewUrl} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                      <Camera size={32} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  )}
              </div>
              <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground p-2 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                <Camera size={14} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Display Name</label>
                <input 
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Bio (Optional)</label>
                <textarea 
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell us about your gaming life..."
                  className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 h-24 resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                />
              </div>
            </div>

            <button 
                onClick={() => setStep(2)} 
                disabled={!displayName.trim()}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-black text-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group"
            >
              Next Step <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Step 2: Playstyle */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight">How do you play?</h1>
              <p className="text-muted-foreground font-medium">This helps friends understand your style.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {PLAYSTYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setPlaystyle(style.id)}
                  className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border text-left transition-all relative overflow-hidden group",
                      playstyle === style.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' 
                        : 'border-border bg-card hover:bg-muted/50 hover:border-primary/30'
                  )}
                >
                  <div className={cn(
                      "p-3 rounded-lg transition-colors",
                      playstyle === style.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-primary'
                  )}>
                    <style.icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-foreground">{style.label}</div>
                    <div className="text-xs text-muted-foreground">{style.desc}</div>
                  </div>
                  {playstyle === style.id && (
                      <div className="absolute right-4 text-primary animate-in zoom-in">
                          <Check size={20} />
                      </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(1)} 
                className="flex-1 py-3 text-muted-foreground font-bold hover:bg-muted rounded-xl transition-colors"
              >
                Back
              </button>
              <button 
                onClick={finishOnboarding} 
                disabled={!playstyle || loading}
                className="flex-[2] bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Finalizing...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
