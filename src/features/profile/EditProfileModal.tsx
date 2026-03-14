import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { Badge } from '../gamification/logic/types';
import { ProfileSettings } from './useProfileSettings';
import { Save, User, Tag, Check, Upload, Loader2, PenLine, Database } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { supabase } from '../../lib/cloud/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { GENERAL_MARKS } from '../gamification/logic/generalMarks';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ProfileSettings;
  unlockedBadges: Badge[];
  unlockedArtifacts: string[];
  onSave: (settings: Partial<ProfileSettings>) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentSettings, unlockedBadges, unlockedArtifacts, onSave }: EditProfileModalProps) {
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
        // 1. Update Identity in 'profiles'
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                display_name: formData.displayName,
                bio: formData.bio,
                playstyle: formData.title,
                avatar_url: formData.avatarUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (profileError) throw profileError;

        // 2. Update Showcase Preferences in 'player_stats'
        const { error: statsError } = await supabase
            .from('player_stats')
            .update({
                pinned_badges: formData.pinned_badges,
                pinned_artifacts: formData.pinned_artifacts
            })
            .eq('user_id', user.id);
            
        if (statsError) throw statsError;

        // 3. Notify User & Local Update
        toast.success("Profile updated successfully!");
        onSave(formData);
        onClose();

    } catch (error: any) {
        console.error("Profile Update Error:", error);
        toast.error("Failed to update profile: " + error.message);
    } finally {
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

        {/* --- VISIBILITY SETTINGS --- */}
        <div className="space-y-4 pt-4 border-t border-border/50">
           <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Showcase Customization</h3>
           
           {/* Milestone Selector */}
           <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Visible Milestones (Select to Show)</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-muted/20 rounded-lg border border-border/50">
                 {unlockedBadges.map(badge => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => {
                        const current = formData.pinned_badges || [];
                        const exists = current.includes(badge.id);
                        setFormData({
                            ...formData,
                            pinned_badges: exists 
                                ? current.filter(id => id !== badge.id)
                                : [...current, badge.id]
                        });
                      }}
                      className={cn(
                          "p-2 rounded text-xs font-bold text-left flex items-center gap-2 transition-colors",
                          (formData.pinned_badges || []).includes(badge.id)
                              ? "bg-primary/20 text-primary border border-primary/50"
                              : "bg-card text-muted-foreground border border-border opacity-50 hover:opacity-100"
                      )}
                    >
                       <Check size={12} className={cn("opacity-0", (formData.pinned_badges || []).includes(badge.id) && "opacity-100")} />
                       <span className="truncate">{badge.label || (badge as any).title}</span>
                    </button>
                 ))}
              </div>
           </div>

           {/* Artifact Selector */}
           <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                 <Database size={12} /> Visible Artifacts (Select to Show)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-muted/20 rounded-lg border border-border/50">
                 {GENERAL_MARKS.filter(m => unlockedArtifacts.includes(m.id)).map(mark => (
                    <button
                      key={mark.id}
                      type="button"
                      onClick={() => {
                        const current = formData.pinned_artifacts || [];
                        const exists = current.includes(mark.id);
                        setFormData({
                            ...formData,
                            pinned_artifacts: exists 
                                ? current.filter(id => id !== mark.id)
                                : [...current, mark.id]
                        });
                      }}
                      className={cn(
                          "p-2 rounded text-xs font-bold text-left flex items-center gap-2 transition-colors",
                          (formData.pinned_artifacts || []).includes(mark.id)
                              ? "bg-cyan-500/20 text-cyan-500 border border-cyan-500/50"
                              : "bg-card text-muted-foreground border border-border opacity-50 hover:opacity-100"
                      )}
                    >
                       <Check size={12} className={cn("opacity-0", (formData.pinned_artifacts || []).includes(mark.id) && "opacity-100")} />
                       <span className="truncate">{mark.title}</span>
                    </button>
                 ))}
                 
                 {/* Fallback if no artifacts are unlocked */}
                 {unlockedArtifacts.length === 0 && (
                     <div className="col-span-2 text-center text-xs text-muted-foreground italic py-4 border-2 border-dashed border-border/50 rounded">
                         No artifacts unlocked yet.
                     </div>
                 )}
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