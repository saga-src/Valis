import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { Badge } from '../gamification/logic/types';
import { ProfileSettings } from './useProfileSettings';
import { Save, User, Tag, Check, Upload, Loader2, PenLine } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { supabase } from '../../lib/cloud/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ProfileSettings;
  unlockedBadges: Badge[];
  onSave: (settings: Partial<ProfileSettings>) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentSettings, unlockedBadges, onSave }: EditProfileModalProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) setFormData(currentSettings);
  }, [isOpen, currentSettings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        // If no cloud user, just update local settings
        onSave(formData);
        onClose();
        return;
    }

    setIsSaving(true);
    try {
        // 1. Update Supabase
        const { error } = await supabase
            .from('profiles')
            .update({
                display_name: formData.displayName,
                bio: formData.bio,
                playstyle: formData.title,
                avatar_url: formData.avatarUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) throw error;

        // 2. Notify User & Local Update
        toast.success("Profile updated successfully!");
        onSave(formData);
        onClose();

        // 3. Trigger full reload to refresh all context/sidebar data
        setTimeout(() => {
            window.location.reload();
        }, 500);

    } catch (error: any) {
        console.error("Profile Update Error:", error);
        toast.error("Failed to update profile: " + error.message);
        setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Operative Profile">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
           <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 group-hover:border-primary transition-all bg-zinc-800 flex items-center justify-center">
                {formData.avatarUrl ? (
                    <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <User size={32} className="text-muted-foreground" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <Upload size={16} className="text-white" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
           </div>
           <div className="flex-1">
              <h3 className="font-bold text-foreground">Operative Avatar</h3>
              <p className="text-xs text-muted-foreground mt-1">Recommended size 400x400. Max 2MB.</p>
           </div>
        </div>

        <div className="space-y-4">
           {/* Username (Locked) */}
           <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <User size={14} /> Operative ID
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.username}
                  disabled
                  className="w-full bg-secondary/50 border border-border rounded-lg py-2.5 px-4 text-sm text-muted-foreground cursor-not-allowed opacity-70 font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground pl-1 italic">Network IDs are immutable once registered.</p>
           </div>

           {/* Display Name */}
           <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <PenLine size={14} /> Alias (Display Name)
              </label>
              <input 
                type="text" 
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="w-full bg-muted/30 border border-border rounded-lg py-2.5 px-4 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold"
                placeholder="How should you be known?"
                maxLength={25}
              />
           </div>

           {/* Title (Playstyle) */}
           <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Tag size={14} /> Rank Title
              </label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-muted/30 border border-border rounded-lg py-2.5 px-4 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="e.g. Master of RPGs"
                maxLength={30}
              />
           </div>

           {/* Bio */}
           <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Biography</label>
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                placeholder="Brief mission summary or personal lore..."
                className="w-full bg-muted/30 border border-border rounded-lg p-4 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                rows={3}
                maxLength={200}
              />
           </div>

           {/* Badge Selector */}
           <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Highlight Badge</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 pr-2 custom-scrollbar">
                 <button
                   type="button"
                   onClick={() => setFormData({...formData, highlightBadgeId: null})}
                   className={cn(
                       "p-2 rounded-lg border text-xs font-bold text-left transition-all",
                       !formData.highlightBadgeId 
                           ? 'border-primary bg-primary/10 text-primary' 
                           : 'border-border bg-card text-muted-foreground hover:bg-muted'
                   )}
                 >
                   No Highlight
                 </button>
                 {unlockedBadges.map(badge => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => setFormData({...formData, highlightBadgeId: badge.id})}
                      className={cn(
                          "p-2 rounded-lg border text-xs font-bold text-left flex items-center gap-2 transition-all",
                          formData.highlightBadgeId === badge.id 
                              ? 'border-primary bg-primary/10 text-primary' 
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <span className="text-base">{badge.icon}</span> 
                      <span className="truncate">{badge.label}</span>
                      {formData.highlightBadgeId === badge.id && <Check size={12} className="ml-auto text-primary" />}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <button 
           type="submit"
           disabled={isSaving || !formData.displayName.trim()}
           className="w-full py-4 bg-primary text-primary-foreground font-black text-lg rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
        >
           {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
           {isSaving ? 'Synchronizing...' : 'Save Profile'}
        </button>
      </form>
    </Modal>
  );
}