
import React, { useState, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { GamerProfile } from '../gamification/logic/types';
import { ProfileSettings } from './useProfileSettings';
import { Download, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { cn } from '../../lib/utils/cn';
import { Save } from 'lucide-react';

interface ProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: GamerProfile;
  settings: ProfileSettings;
}

export default function ProfileShareModal({ isOpen, onClose, profile, settings }: ProfileShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'carbon' | 'gradient' | 'minimal'>('gradient');
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, { 
        backgroundColor: null, // Transparent background if needed
        scale: 2, // High resolution (Retina)
        useCORS: true, // Handle external images (like avatars)
        logging: false
      });
      
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.download = `valis-profile-${settings.username || 'user'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Badge Logic
  const highlightBadge = settings.highlightBadgeId 
    ? profile.badges.find(b => b.id === settings.highlightBadgeId)
    : null;
  const progressPercent = (profile.currentXp / profile.nextLevelXp) * 100;

  // Theme Styles
  const getThemeStyles = () => {
    switch(theme) {
      case 'carbon': return "bg-zinc-900 border-zinc-800 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]";
      case 'minimal': return "bg-zinc-950 border-white/10";
      default: return "bg-zinc-900 border-white/10"; // Gradient is handled in the header
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Profile Card">
      <div className="flex flex-col gap-6">
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
           {['gradient', 'carbon', 'minimal'].map(t => (
             <button
               key={t}
               onClick={() => setTheme(t as any)}
               className={cn(
                 "px-4 py-2 rounded-lg text-sm font-bold capitalize border transition-all",
                 theme === t ? "bg-primary text-primary-foreground border-primary" : "bg-zinc-800 border-white/10 hover:bg-zinc-700"
               )}
             >
               {t}
             </button>
           ))}
        </div>

        {/* PREVIEW AREA (The Card to Capture) */}
        <div className="flex justify-center p-4 bg-black/20 rounded-xl overflow-hidden overflow-x-auto">
           <div 
             ref={cardRef}
             className={cn("w-[350px] shrink-0 rounded-2xl overflow-hidden shadow-2xl relative border", getThemeStyles())}
           >
             {/* Header */}
             <div className={cn(
               "h-32 relative",
               theme === 'minimal' ? "bg-zinc-900" : "bg-gradient-to-r from-primary/80 to-purple-600/80"
             )}>
                {theme !== 'minimal' && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay" />}
             </div>

             <div className="px-6 pb-6 relative">
                 {/* Avatar */}
                 <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-900 absolute -top-12 left-6 overflow-hidden shadow-xl">
                     <img src={settings.avatarUrl} className="w-full h-full object-cover" crossOrigin="anonymous" />
                 </div>

                 {/* Info */}
                 <div className="pl-28 pt-3 mb-6">
                    <h2 className="text-2xl font-black text-white leading-tight">{settings.username}</h2>
                    <div className="text-xs font-bold text-zinc-500 uppercase mt-1">{settings.title}</div>
                    {highlightBadge && (
                      <div className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 border border-white/10 mt-2", highlightBadge.color)}>
                         <span>{highlightBadge.icon}</span> {highlightBadge.label}
                      </div>
                    )}
                 </div>

                 {/* Stats Row */}
                 <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                       <div className="text-[10px] uppercase text-zinc-500 font-bold">Most Played</div>
                       <div className="font-bold text-sm text-white truncate">
                         {profile.activity.mostPlayedGame?.title || "-"}
                       </div>
                       <div className="text-[10px] text-primary">
                         {profile.activity.mostPlayedGame ? (profile.activity.mostPlayedGame.playtimeMinutes / 60).toFixed(0) + 'h' : ''}
                       </div>
                    </div>
                    <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                       <div className="text-[10px] uppercase text-zinc-500 font-bold">Top Rated</div>
                       <div className="font-bold text-sm text-white truncate">
                         {profile.activity.highestRatedGame?.title || "-"}
                       </div>
                       <div className="text-[10px] text-yellow-500">
                         {profile.activity.highestRatedGame?.score ? Math.round(profile.activity.highestRatedGame.score) : ''} Score
                       </div>
                    </div>
                 </div>

                 {/* Level Bar */}
                 <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between items-end mb-2">
                       <div><span className="text-xs font-bold text-zinc-500">LEVEL</span> <span className="text-2xl font-black text-white">{profile.level}</span></div>
                       <div className="text-xs text-zinc-400 font-mono">{Math.floor(profile.currentXp)} / {profile.nextLevelXp}</div>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                       <div className="h-full bg-gradient-to-r from-primary to-purple-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                 </div>

                 {/* Branding Footer */}
                 <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center opacity-50">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white">
                       <div className="w-2 h-2 bg-primary rounded-full" /> Valis
                    </div>
                 </div>
             </div>
           </div>
        </div>

        <button 
           onClick={handleDownload}
           disabled={isExporting}
           className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
        >
           {isExporting ? <Check className="animate-pulse" /> : <Download size={20} />} 
           {isExporting ? 'Capturing...' : 'Download Card'}
        </button>
      </div>
    </Modal>
  );
}