import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { Badge } from '../gamification/logic/types';
import { ProfileSettings } from './useProfileSettings';
import { Save, User, Tag, Check, Upload } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ProfileSettings;
  unlockedBadges: Badge[];
  onSave: (settings: Partial<ProfileSettings>) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentSettings, unlockedBadges, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState(currentSettings);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Identity">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-2">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/50 shadow-xl bg-zinc-800 cursor-pointer group relative"
            >
               <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
               
               {/* Overlay */}
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="text-white" size={24} />
               </div>
            </div>
            <span className="text-xs text-muted-foreground">Click to upload image</span>
            <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileChange} 
               className="hidden" 
               accept="image/*"
            />
        </div>

        <div className="space-y-4">
            {/* Username Input */}
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                 <User size={14} /> Username
               </label>
               <input 
                 type="text" 
                 value={formData.username}
                 onChange={e => setFormData({...formData, username: e.target.value})}
                 className="w-full bg-muted/30 border border-border rounded-lg p-3 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors font-bold"
                 placeholder="Enter name..."
                 maxLength={20}
               />
            </div>

            {/* Title Input */}
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                 <Tag size={14} /> Title
               </label>
               <input 
                 type="text" 
                 value={formData.title}
                 onChange={e => setFormData({...formData, title: e.target.value})}
                 className="w-full bg-muted/30 border border-border rounded-lg p-3 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                 placeholder="e.g. RPG Master"
                 maxLength={30}
               />
            </div>

            {/* Badge Selector */}
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Highlight Badge</label>
               <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 pr-2">
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
                    None
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
                       {formData.highlightBadgeId === badge.id && <Check size={12} className="ml-auto" />}
                     </button>
                  ))}
               </div>
            </div>
        </div>

        <button 
           type="submit"
           className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
        >
           <Save size={18} /> Save Changes
        </button>
      </form>
    </Modal>
  );
}