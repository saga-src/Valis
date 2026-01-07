
import React, { useState, useEffect } from 'react';
import ShareCard, { ShareGameData } from './ShareCard';
import html2canvas from 'html2canvas';
import { Download, Share2, Loader2, Palette, Eye, Clock, Star, Flag, Quote, Check, Copy } from 'lucide-react';
import { getSessions } from '../../lib/storage';
import { cn } from '../../lib/utils/cn';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: any; // Raw DB game object
}

export type CardStyle = 'editorial' | 'retro' | 'polaroid' | 'immersive';

export default function ShareModal({ isOpen, onClose, game }: ShareModalProps) {
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareData, setShareData] = useState<ShareGameData | null>(null);
  const [proxyCover, setProxyCover] = useState<string | null>(null);
  
  // Customization State
  const [showTime, setShowTime] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [cardStyle, setCardStyle] = useState<CardStyle>('editorial');
  const [customQuote, setCustomQuote] = useState('');

  const CARD_ID = `share-card-${game?.id}`;

  // 1. Load Data on Open
  useEffect(() => {
    if (isOpen && game) {
      const loadData = async () => {
        try {
          const sessions = await getSessions(game.id);
          const totalMinutes = sessions.reduce((acc: number, curr: any) => acc + (curr.duration_minutes || 0), 0);
          
          let genres = [];
          try { genres = JSON.parse(game.genres || '[]'); } catch {}

          let timeToBeat = {};
          try { timeToBeat = JSON.parse(game.time_to_beat || '{}'); } catch {}

          let companies = [];
          try { companies = JSON.parse(game.involved_companies || '[]'); } catch {}

          setShareData({
            title: game.title,
            cover_url: game.cover_url,
            status: game.status,
            release_year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear().toString() : 'Unknown',
            genres: genres.map((g: any) => g.name),
            rating: game.final_score ? game.final_score * 10 : 0,
            playtime_seconds: totalMinutes * 60,
            time_to_beat: timeToBeat,
            involved_companies: companies
          });

          // Fetch Proxy Cover immediately
          if (game.cover_url && window.api) {
             const base64 = await window.api.proxyImage(game.cover_url);
             if (base64) setProxyCover(base64);
          }

        } catch (e) {
          console.error("Failed to prep share data", e);
        }
      };
      loadData();
    } else {
        setProxyCover(null);
        setShareData(null);
        setCopied(false);
        setCustomQuote('');
    }
  }, [isOpen, game]);

  // Helper: Common Capture Logic
  const generateBlob = async (): Promise<Blob | null> => {
    // 1. Pre-load image
    const finalCover = proxyCover || shareData?.cover_url;
    if (finalCover) {
        await new Promise((resolve) => {
           const img = new Image();
           img.crossOrigin = "anonymous";
           img.onload = () => resolve(true);
           img.onerror = () => resolve(true);
           img.src = finalCover;
        });
    }
    
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 300)); // Slight buffer for layout

    const element = document.getElementById(CARD_ID);
    if (!element) return null;

    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null, // Transparent bg so border radius/shapes work
      scale: 2, 
      onclone: (doc) => {
          const el = doc.getElementById(CARD_ID);
          if (el) el.style.transform = 'none';
      }
    });

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownload = async () => {
    if (!shareData) return;
    setGenerating(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Generation failed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${game.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-card.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate image.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareData) return;
    setCopying(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Generation failed");
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to copy.");
    } finally {
      setCopying(false);
    }
  };

  if (!isOpen || !shareData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[850px]">
        
        {/* HEADER (Mobile Only) */}
        <div className="md:hidden p-4 border-b border-white/10 flex justify-between items-center shrink-0 bg-zinc-900">
             <h3 className="font-bold text-white flex items-center gap-2"><Share2 size={18} /> Valis Studio</h3>
             <button onClick={onClose} className="text-zinc-400">✕</button>
        </div>

        {/* LEFT: PREVIEW AREA */}
        <div className="flex-1 bg-zinc-900/50 relative flex items-center justify-center p-8 overflow-hidden group">
            {/* Checkerboard Pattern for transparent visual */}
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            {/* The Actual Card (Scaled) */}
            <div className="scale-[0.4] sm:scale-[0.5] lg:scale-[0.65] xl:scale-[0.75] transition-transform duration-500 ease-out origin-center shadow-2xl">
               <ShareCard 
                 game={shareData} 
                 elementId={CARD_ID} 
                 coverOverride={proxyCover}
                 options={{ showTime, showRating, showStatus, style: cardStyle, customQuote }}
               />
            </div>
            
            <div className="absolute bottom-6 left-6 text-xs text-zinc-500 font-mono bg-zinc-950/80 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
               1200x630px • {cardStyle.toUpperCase()}
            </div>
        </div>

        {/* RIGHT: CONTROLS */}
        <div className="w-full md:w-96 bg-zinc-950 border-l border-white/10 flex flex-col shrink-0">
            <div className="hidden md:flex justify-between items-center p-6 border-b border-white/10">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                   <Share2 size={20} className="text-primary" /> Valis Studio
                </h2>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 p-1 rounded-md">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Theme Selector */}
                <div className="space-y-3">
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                       <Palette size={12} /> Theme
                   </label>
                   <div className="grid grid-cols-2 gap-2">
                      {(['editorial', 'retro', 'polaroid', 'immersive'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setCardStyle(s)}
                          className={cn(
                              "px-3 py-3 rounded-lg border text-center text-sm font-bold transition-all",
                              cardStyle === s 
                                ? 'bg-primary text-primary-foreground border-primary shadow-md transform scale-[1.02]' 
                                : 'bg-zinc-900 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                          )}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Quote Input */}
                <div className="space-y-3">
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                       <Quote size={12} /> Custom Text
                   </label>
                   <div className="relative">
                     <textarea 
                        value={customQuote}
                        onChange={(e) => setCustomQuote(e.target.value)}
                        placeholder="Add a review quote, memory, or subtitle..."
                        className="w-full h-24 bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        maxLength={100}
                     />
                     <div className="absolute bottom-2 right-2 text-[10px] text-zinc-600">
                        {customQuote.length}/100
                     </div>
                   </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                       <Eye size={12} /> Visibility
                   </label>
                   
                   <div className="space-y-2">
                       <label className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-colors">
                          <span className="text-sm text-zinc-300 flex items-center gap-2"><Clock size={14} /> Playtime</span>
                          <input type="checkbox" checked={showTime} onChange={e => setShowTime(e.target.checked)} className="accent-primary w-4 h-4" />
                       </label>
                       
                       <label className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-colors">
                          <span className="text-sm text-zinc-300 flex items-center gap-2"><Star size={14} /> Rating / Score</span>
                          <input type="checkbox" checked={showRating} onChange={e => setShowRating(e.target.checked)} className="accent-primary w-4 h-4" />
                       </label>

                       <label className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-white/5 cursor-pointer hover:bg-zinc-900 transition-colors">
                          <span className="text-sm text-zinc-300 flex items-center gap-2"><Flag size={14} /> Status Badge</span>
                          <input type="checkbox" checked={showStatus} onChange={e => setShowStatus(e.target.checked)} className="accent-primary w-4 h-4" />
                       </label>
                   </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-white/10 bg-zinc-900/30">
                <div className="flex gap-3">
                    <button 
                       onClick={handleCopy}
                       disabled={generating || copying}
                       className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 border border-zinc-700 active:scale-95"
                    >
                       {copying ? <Loader2 className="animate-spin" size={20} /> : copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                       <span className="hidden sm:inline">{copying ? 'Copying...' : copied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <button 
                       onClick={handleDownload}
                       disabled={generating || copying}
                       className="flex-[2] py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
                    >
                       {generating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                       {generating ? 'Rendering...' : 'Download PNG'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}