import React, { useState } from 'react';
import { Tag, Plus, Trash2, Check, X, Settings2, RotateCcw, Pencil } from 'lucide-react';
import { useLibraryStore } from '../../../store/libraryStore';
import { useTagFilters } from '../hooks/useTagFilters';
import { cn } from '../../../lib/utils/cn';

export const TagFilterPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  
  // Edit State
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const { tags, tagFilters, toggleTagFilter, clearTagFilters } = useLibraryStore();
  const { refreshTags } = useTagFilters();

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !window.api) return;

    const res = await window.api.createTag(newTagName.trim(), '#7c3aed');
    if (res.success) {
      setNewTagName('');
      refreshTags();
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!window.api || !confirm('Delete this tag? It will be removed from all games.')) return;
    const res = await window.api.deleteTag(id);
    if (res.success) {
      refreshTags();
      if (editingTagId === id) handleCancelEdit();
    }
  };

  const handleStartEdit = (tag: any) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#ffffff');
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditName('');
    setEditColor('');
  };

  const handleUpdateTag = async (id: number) => {
    if (!editName.trim() || !window.api) return;

    const res = await window.api.updateTag(id, editName.trim(), editColor);
    if (res.success) {
      handleCancelEdit();
      refreshTags();
    }
  };

  const activeFilterCount = tagFilters.include.length + tagFilters.exclude.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all border",
          isOpen || activeFilterCount > 0 
            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
            : "bg-card border-border hover:bg-muted text-muted-foreground"
        )}
      >
        <Tag size={16} />
        <span className="hidden sm:inline">Tags</span>
        {activeFilterCount > 0 && (
          <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] font-black">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-3 w-80 bg-popover border border-border rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {isManageMode ? 'Manage Tags' : 'Filter by Tags'}
              </h3>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && !isManageMode && (
                  <button 
                    onClick={clearTagFilters}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all"
                    title="Reset Filters"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsManageMode(!isManageMode);
                    handleCancelEdit();
                  }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    isManageMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"
                  )}
                  title="Toggle Manage Mode"
                >
                  <Settings2 size={14} />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {isManageMode ? (
                /* Manage Mode UI */
                <div className="space-y-4">
                  <form onSubmit={handleCreateTag} className="flex gap-2">
                    <input 
                      autoFocus
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="New tag name..."
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={!newTagName.trim()}
                      className="bg-primary text-primary-foreground p-1.5 rounded-lg disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </form>

                  <div className="space-y-1">
                    {tags.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No tags created yet.</p>
                    ) : (
                      tags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-lg group transition-colors">
                          {editingTagId === tag.id ? (
                            <>
                              <div 
                                className="relative w-6 h-6 shrink-0 rounded-md border border-white/20 shadow-inner" 
                                style={{ backgroundColor: editColor }}
                              >
                                <input 
                                  type="color" 
                                  value={editColor} 
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                              </div>
                              <input 
                                autoFocus
                                type="text" 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateTag(tag.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary outline-none"
                              />
                              <div className="flex gap-1 shrink-0">
                                <button 
                                  onClick={() => handleUpdateTag(tag.id)} 
                                  className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                                  title="Save Changes"
                                >
                                  <Check size={14} strokeWidth={3} />
                                </button>
                                <button 
                                  onClick={handleCancelEdit} 
                                  className="p-1 text-muted-foreground hover:bg-muted rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div 
                                className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/10" 
                                style={{ backgroundColor: tag.color || '#ffffff' }} 
                              />
                              <span className="flex-1 text-sm font-medium truncate">{tag.name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => handleStartEdit(tag)}
                                  className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                  title="Edit Tag"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTag(tag.id)}
                                  className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                  title="Delete Tag"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Filter Mode UI */
                <div className="flex flex-wrap gap-2">
                  {tags.length === 0 ? (
                    <div className="w-full text-center py-6 space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">You haven't defined any custom tags yet.</p>
                      <button 
                        onClick={() => setIsManageMode(true)}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Create your first tag
                      </button>
                    </div>
                  ) : (
                    tags.map(tag => {
                      const isIncluded = tagFilters.include.includes(tag.id);
                      const isExcluded = tagFilters.exclude.includes(tag.id);

                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagFilter(tag.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            isIncluded ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500 shadow-sm" :
                            isExcluded ? "bg-red-500/10 border-red-500/50 text-red-500 shadow-sm" :
                            "bg-background border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30"
                          )}
                        >
                          {isIncluded && <Check size={12} strokeWidth={3} />}
                          {isExcluded && <X size={12} strokeWidth={3} />}
                          {tag.name}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {!isManageMode && tags.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/10 text-[9px] text-muted-foreground uppercase font-black tracking-widest text-center">
                Click to Cycle: Include → Exclude → Neutral
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};