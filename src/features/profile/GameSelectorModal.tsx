import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { Search, Trash2 } from 'lucide-react';
import { getCoverUrl } from '../../lib/api/igdb';

interface GameSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: any[];
  onSelect: (gameId: string | null) => void;
}

export default function GameSelectorModal({ isOpen, onClose, games, onSelect }: GameSelectorModalProps) {
  const [search, setSearch] = useState('');

  const filtered = games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Game">
      <div className="flex flex-col h-[60vh] max-h-[500px]">
        {/* Search */}
        <div className="relative mb-4 shrink-0">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
           <input 
             autoFocus
             type="text" 
             placeholder="Search your library..." 
             className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
        </div>

        {/* Clear Option */}
        <button 
            onClick={() => { onSelect(null); onClose(); }}
            className="flex items-center gap-3 p-3 hover:bg-destructive/10 text-destructive rounded-lg transition-colors mb-2 shrink-0 group border border-transparent hover:border-destructive/20"
        >
            <div className="w-10 h-10 flex items-center justify-center bg-destructive/10 rounded-md group-hover:bg-destructive/20">
                <Trash2 size={18} />
            </div>
            <span className="font-bold">Clear Slot</span>
        </button>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
           {filtered.map(game => (
             <button
               key={game.id}
               onClick={() => { onSelect(game.id); onClose(); }}
               className="w-full flex items-center gap-4 p-2 hover:bg-accent/50 rounded-lg transition-colors group text-left border border-transparent hover:border-border"
             >
               <div className="w-10 h-14 bg-muted rounded overflow-hidden shrink-0 border border-border/50">
                  <img 
                    src={getCoverUrl(game.cover_url, 'big')} 
                    className="w-full h-full object-cover" 
                    alt={game.title}
                    loading="lazy"
                  />
               </div>
               <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{game.title}</span>
             </button>
           ))}
           {filtered.length === 0 && <div className="text-center text-muted-foreground py-10">No games found</div>}
        </div>
      </div>
    </Modal>
  );
}