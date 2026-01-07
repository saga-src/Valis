
import React from 'react';
import { Save, Flag, Star, Trophy, Gamepad2, Disc, Quote, Clock, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { CardStyle } from './ShareModal';

export interface ShareGameData {
  title: string;
  cover_url: string;
  status: string;
  release_year: string;
  genres: string[];
  rating: number; // 0-100
  playtime_seconds: number;
  involved_companies: { developer: boolean; company: { name: string } }[];
  time_to_beat?: { normally?: number };
}

interface ShareCardProps {
  game: ShareGameData;
  elementId: string;
  coverOverride?: string | null;
  options: {
    showTime: boolean;
    showRating: boolean;
    showStatus: boolean;
    customQuote: string;
    style: CardStyle;
  };
}

export default function ShareCard({ game, elementId, coverOverride, options }: ShareCardProps) {
  const finalCover = coverOverride || game.cover_url;
  const { style, showTime, showRating, showStatus, customQuote } = options;

  // Data Formatting
  const developer = game.involved_companies?.find(c => c.developer)?.company.name || "Unknown Dev";
  const rating10 = game.rating ? (game.rating / 10).toFixed(1) : null;
  const hours = (game.playtime_seconds / 3600).toFixed(1);

  // --- RENDERERS FOR EACH STYLE ---

  // 1. EDITORIAL (Magazine / IGN Style)
  const renderEditorial = () => (
    <div className="w-full h-full bg-white text-zinc-900 flex font-sans">
       {/* Left: Giant Cover */}
       <div className="w-[45%] h-full relative">
          {finalCover && <img src={finalCover} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10" />
       </div>

       {/* Right: Content */}
       <div className="flex-1 p-16 flex flex-col justify-center relative bg-zinc-50">
          <div className="absolute top-12 right-16 flex items-center gap-2 opacity-30">
             <Save size={24} className="text-zinc-900" />
             <span className="font-black tracking-widest uppercase">Valis</span>
          </div>

          <div className="space-y-6 z-10">
             {/* Giant Rating Badge */}
             {showRating && rating10 && (
               <div className="w-32 h-32 rounded-full bg-zinc-900 text-white flex flex-col items-center justify-center shadow-2xl mb-6">
                 <span className="text-5xl font-black">{rating10}</span>
                 <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Score</span>
               </div>
             )}

             <div className="space-y-2">
               <h1 className="text-7xl font-black tracking-tighter leading-[0.9] text-zinc-900 uppercase line-clamp-3">
                 {game.title}
               </h1>
               <div className="flex items-center gap-4 text-xl font-bold text-zinc-500">
                  <span>{developer}</span>
                  {game.release_year && <span>• {game.release_year}</span>}
               </div>
             </div>
             
             {/* The Quote */}
             {customQuote && (
               <div className="border-l-4 border-primary pl-6 py-2">
                 <p className="text-3xl font-serif italic text-zinc-800 leading-tight">"{customQuote}"</p>
               </div>
             )}

             <div className="flex gap-8 pt-8 border-t border-zinc-200 mt-8">
                {showTime && (
                   <div>
                     <div className="text-xs font-black uppercase text-zinc-400 tracking-wider mb-1">Playtime</div>
                     <div className="text-4xl font-black text-zinc-900">{hours}h</div>
                   </div>
                )}
                {showStatus && (
                   <div>
                     <div className="text-xs font-black uppercase text-zinc-400 tracking-wider mb-1">Status</div>
                     <div className="text-4xl font-black text-primary uppercase">{game.status}</div>
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  );

  // 2. RETRO (CRT / Arcade)
  const renderRetro = () => (
    <div className="w-full h-full bg-black text-[#00ff41] font-mono relative overflow-hidden flex flex-col p-12 border-[16px] border-[#00ff41]">
       {/* Scanlines Overlay */}
       <div className="absolute inset-0 z-20 pointer-events-none opacity-20" 
            style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 6px 100%' }} />
       
       {/* Background Image (Dimmed) */}
       <div className="absolute inset-0 opacity-20 grayscale blur-sm z-0" 
            style={{ backgroundImage: `url(${finalCover})`, backgroundSize: 'cover' }} />

       <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start border-b-4 border-[#00ff41] pb-6">
             <div className="space-y-2">
                <div className="bg-[#00ff41] text-black px-4 py-1 inline-block font-bold text-xl">
                   INSERT COIN
                </div>
                <h1 className="text-6xl font-bold uppercase tracking-widest drop-shadow-[4px_4px_0_rgba(0,100,0,1)] line-clamp-1">
                   {game.title}
                </h1>
             </div>
             {showRating && rating10 && (
                <div className="text-right">
                   <div className="text-xl">SCORE</div>
                   <div className="text-7xl font-bold animate-pulse">{Math.round(Number(rating10) * 1000)}</div>
                </div>
             )}
          </div>

          <div className="flex gap-16 items-center flex-1">
             <div className="w-64 h-80 border-4 border-[#00ff41] p-2 bg-black shrink-0">
                {finalCover && <img src={finalCover} className="w-full h-full object-cover grayscale contrast-125" alt="" crossOrigin="anonymous" />}
             </div>
             
             <div className="flex-1 space-y-8">
                {customQuote && <div className="text-3xl text-white font-bold">&gt; Console.log("{customQuote}");</div>}
                
                <div className="grid grid-cols-2 gap-8 text-2xl">
                   {showTime && <div><span className="opacity-70">TIME_PLAYED:</span> <span className="text-white">{hours}HRS</span></div>}
                   {showStatus && <div><span className="opacity-70">STATUS:</span> <span className="animate-pulse">{game.status.toUpperCase()}</span></div>}
                   <div><span className="opacity-70">SYSTEM:</span> PC_DOS</div>
                   <div><span className="opacity-70">YEAR:</span> {game.release_year}</div>
                </div>
             </div>
          </div>
          
          <div className="text-center text-xl opacity-70 mt-auto">
             Generate by Valis.exe // v1.0
          </div>
       </div>
    </div>
  );

  // 3. POLAROID (Scrapbook)
  const renderPolaroid = () => (
    <div className="w-full h-full bg-[#f0f0f0] text-zinc-800 flex items-center justify-center relative overflow-hidden font-sans">
        {/* Texture */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        <div className="flex gap-16 transform rotate-1 p-16 w-full max-w-6xl items-center">
            {/* The Photo */}
            <div className="shrink-0 bg-white p-6 pb-24 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] transform -rotate-2 relative w-[450px]">
               <div className="aspect-[3/4] bg-zinc-200 overflow-hidden grayscale-[20%]">
                 {finalCover && <img src={finalCover} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />}
               </div>
               <div className="absolute bottom-6 left-0 right-0 text-center font-serif text-4xl text-zinc-800 italic opacity-90 px-4 truncate">
                  {game.title}
               </div>
               {/* Tape */}
               <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-12 bg-yellow-200/80 rotate-1 shadow-sm opacity-90" />
            </div>

            {/* The Notes */}
            <div className="flex-1 space-y-12">
               <div>
                  <h2 className="text-8xl font-black text-zinc-900 tracking-tighter mb-6">{rating10 ? `${rating10}/10` : 'No Rating'}</h2>
                  {customQuote && (
                    <p className="text-4xl font-serif leading-relaxed text-zinc-700 italic relative">
                       <span className="absolute -left-8 -top-4 text-8xl text-zinc-300 font-sans">“</span>
                       {customQuote}
                    </p>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-6 border-t-4 border-zinc-300 pt-8 font-mono text-xl uppercase tracking-widest text-zinc-500">
                  {showTime && (
                     <div>
                        <span className="block text-xs mb-1">Time Spent</span>
                        <strong className="text-zinc-900 text-3xl">{hours}h</strong>
                     </div>
                  )}
                  {showStatus && (
                     <div>
                        <span className="block text-xs mb-1">Status</span>
                        <strong className="text-zinc-900 text-3xl">{game.status}</strong>
                     </div>
                  )}
                  <div>
                     <span className="block text-xs mb-1">Year</span>
                     <strong className="text-zinc-900 text-3xl">{game.release_year}</strong>
                  </div>
               </div>
               
               <div className="flex items-center gap-2 opacity-40 grayscale">
                  <Save /> <span className="font-bold tracking-widest">VALIS MEMORY</span>
               </div>
            </div>
        </div>
    </div>
  );

  // 4. IMMERSIVE (Cinematic / Netflix)
  const renderImmersive = () => (
    <div className="w-full h-full bg-zinc-950 text-white relative font-sans flex items-end">
        {/* Full BG */}
        <div className="absolute inset-0">
           {finalCover && <img src={finalCover} className="w-full h-full object-cover opacity-60" alt="" crossOrigin="anonymous" />}
           <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 p-20 w-full flex items-end justify-between">
           <div className="max-w-4xl space-y-8">
              {showStatus && (
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-bold uppercase tracking-wider mb-2 border border-white/10">
                    <Flag size={14} className="text-primary" /> {game.status}
                 </div>
              )}
              
              <h1 className="text-8xl font-black tracking-tight leading-none drop-shadow-2xl">
                 {game.title}
              </h1>
              
              <div className="flex items-center gap-8 text-3xl font-medium text-zinc-300">
                 {showRating && rating10 && (
                    <div className="flex items-center gap-2 text-white font-bold">
                       <Star className="fill-yellow-400 text-yellow-400" size={32} /> {rating10}
                    </div>
                 )}
                 {showTime && <span>{hours} Hours Played</span>}
                 <span>{game.release_year}</span>
              </div>

              {customQuote && (
                <p className="text-4xl text-zinc-100 font-light leading-snug max-w-3xl border-l-4 border-primary pl-8 py-2">
                   "{customQuote}"
                </p>
              )}
           </div>

           <div className="text-right opacity-60 space-y-2">
              <div className="w-20 h-20 bg-white text-zinc-950 rounded-2xl flex items-center justify-center mb-2 ml-auto">
                 <Save size={40} />
              </div>
              <div className="font-bold tracking-[0.3em] text-sm">VALIS</div>
           </div>
        </div>
    </div>
  );

  return (
    <div id={elementId} className="w-[1200px] h-[630px] shrink-0 relative overflow-hidden bg-black">
       {style === 'editorial' && renderEditorial()}
       {style === 'retro' && renderRetro()}
       {style === 'polaroid' && renderPolaroid()}
       {style === 'immersive' && renderImmersive()}
    </div>
  );
}