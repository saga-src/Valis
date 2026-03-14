import React, { useEffect, useState, useRef } from 'react';
import { 
  Check, FolderOpen, Tag as TagIcon, Layers, ChevronRight, 
  PlayCircle, Clock, CheckCircle2, XCircle, PauseCircle, Infinity 
} from 'lucide-react';
import { useLibraryStore } from '../../../store/libraryStore';
import { useToast } from '../../../context/ToastContext';
import { Tag } from '../../../types';
import { cn } from '../../../lib/utils/cn';

interface GameContextMenuProps {
  game: any;
  position: { x: number; y: number };
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'Playing', label: 'Playing', icon: PlayCircle, color: 'text-green-500' },
  { value: 'Backlog', label: 'Backlog', icon: Clock, color: 'text-blue-500' },
  { value: 'Beat', label: 'Beat', icon: CheckCircle2, color: 'text-amber-500' },
  { value: 'Completed', label: 'Completed', icon: Check, color: 'text-purple-500' },
  { value: 'Shelved', label: 'Shelved', icon: PauseCircle, color: 'text-gray-500' },
  { value: 'Dropped', label: 'Dropped', icon: XCircle, color: 'text-red-500' },
  { value: 'Endless', label: 'Endless', icon: Infinity, color: 'text-cyan-500' },
];

export const GameContextMenu: React.FC<GameContextMenuProps> = ({ game, position, onClose }) => {
  const { invalidateCache } = useLibraryStore();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Submenu State
  const [activeSubmenu, setActiveSubmenu] = useState<'status' | 'tags' | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [gameTagIds, setGameTagIds] = useState<number[]>([]);

  // 1. Fetch Tags on Mount (this must be able to remove or add tags to a game witouth the ui closing)
  useEffect(() => {
    const loadTags = async () => {
      if (window.api?.getTags) {
        const tags = await window.api.getTags();
        setAllTags(tags);
        // Determine which tags this game has
        const current = (game.tags || []).map((t: any) => t.id);
        setGameTagIds(current);
      }
    };
    loadTags();
  }, [game]);

  // 2. Click Outside Handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Actions
  const handleSetStatus = async (status: string) => {
    try {
      await window.api.updateGame({ ...game, status });
      invalidateCache(); // Refresh grid
      toast.success(`Marked as ${status}`);
      onClose();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleToggleTag = async (tagId: number) => {
    try {
      const isHas = gameTagIds.includes(tagId);
      if (isHas) {
        await window.api.untagGame(game.id, tagId);
        setGameTagIds(prev => prev.filter(id => id !== tagId));
      } else {
        await window.api.tagGame(game.id, tagId);
        setGameTagIds(prev => [...prev, tagId]);
      }
      invalidateCache();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenLocation = async () => {
    const path = game.executable || game.executable_path;
    if (!path) return;
    await window.api.openExplorer(path);
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[1000] w-64 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-100 flex flex-col p-1"
      style={{ top: position.y, left: position.x }}
    >
      {/* HEADER */}
      <div className="px-3 py-2 text-xs font-bold text-muted-foreground border-b border-border/50 mb-1 truncate">
        {game.name || game.title}
      </div>

      {/* STATUS SUBMENU TRIGGER */}
      <div 
        className="relative group"
        onMouseEnter={() => setActiveSubmenu('status')}
      >
        <button className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left">
          <div className="flex items-center gap-2">
            <Layers size={16} /> <span>Set Status</span>
          </div>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>

        {/* Status Submenu Content */}
        {activeSubmenu === 'status' && (
          <div className="absolute left-full top-0 ml-1 w-48 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSetStatus(opt.value)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left"
              >
                <opt.icon size={14} className={opt.color} />
                <span>{opt.label}</span>
                {game.status === opt.value && <Check size={14} className="ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAGS SUBMENU TRIGGER */}
      <div 
        className="relative group"
        onMouseEnter={() => setActiveSubmenu('tags')}
      >
        <button className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left">
          <div className="flex items-center gap-2">
            <TagIcon size={16} /> <span>Tags</span>
          </div>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>

        {/* Tags Submenu Content */}
        {activeSubmenu === 'tags' && (
          <div className="absolute left-full top-0 ml-1 w-56 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-1 max-h-64 overflow-y-auto custom-scrollbar">
            {allTags.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">No tags created</div>
            ) : (
              allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent closing submenu
                    handleToggleTag(tag.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: tag.color || '#fff' }} 
                  />
                  <span className="truncate flex-1">{tag.name}</span>
                  {gameTagIds.includes(tag.id) && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-border/50 my-1" />

      {/* FILE ACTIONS */}
      <button 
        onClick={handleOpenLocation}
        disabled={!game.executable && !game.executable_path}
        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FolderOpen size={16} /> 
        <span>Open File Location</span>
      </button>

    </div>
  );
};