
import React, { useEffect, useState } from 'react';
// Fix: Import useParams and useNavigate from local shim index file to avoid casing conflict with App.tsx
import { useParams, useNavigate } from '../../app/index';
import { useGameMetadata } from './hooks/useGameMetadata';
import { SessionsTab } from './tabs/SessionsTab';
import { ReviewsTab } from './tabs/ReviewsTab';
import { AchievementsTab } from './tabs/AchievementsTab';
import { useGameAchievements } from './hooks/useGameAchievements';
import EditGameModal from './components/EditGameModal';
import ShareModal from '../share/ShareModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils/cn';
import { formatPlaytime } from '../../lib/utils/format';
import { Games } from '../../lib/api';
import { useCachedResource } from '../../lib/cache/useCachedResource';
import { cacheKeys } from '../../lib/cache/cacheKeys';
import { cachePolicies } from '../../lib/cache/cachePolicy';
import { invalidateGameCaches } from '../../lib/cache/invalidation';

// ⚡ New Components
import { GameHero } from './components/GameHero';
import { GameActions } from './components/GameActions';
import { GameMetadata } from './components/GameMetadata';
import { DlcList } from './components/DlcList';

export const GameDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'reviews' | 'achievements'>('overview');

  const gameResource = useCachedResource<any | null>({
    key: id ? cacheKeys.game(id) : 'game:missing',
    fetcher: () => Games.getById(id!),
    policy: cachePolicies.gameDetails,
    enabled: Boolean(id),
    initialData: null,
  });

  const metadata = useGameMetadata(game);
  
  // ⚡ Fetch Achievements at top level to show counts in tabs
  const { achievements, loading: achievementsLoading, refresh: refreshAchievements } = useGameAchievements(game?.id || '');

  // Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadGame = async () => {
    try {
      const data = await gameResource.refresh();
      setGame(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setGame(gameResource.data || null);
    setLoading(gameResource.loading);
  }, [id, gameResource.data, gameResource.loading]);

  const handleUpdateGame = async (updatedGame: any) => {
    // Note: Social broadcasting is now handled inside EditGameModal or useGameActions
    const saved = await Games.update(updatedGame);
    invalidateGameCaches(updatedGame.id);
    setGame(saved || updatedGame);
  };

  const executeDelete = async () => {
    if (!game) return;
    try {
        await Games.delete(game.id);
        toast.success(`"${game.name}" deleted from library`);
        navigate('/');
    } catch (e: any) {
        console.error(e);
        toast.error("Failed to delete game");
    }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading Game Vault...</div>;
  if (!game || !metadata) return <div className="p-10 text-center">Game not found</div>;

  const unlockedAchievements = achievements.filter(a => !!a.unlockedAt).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto animate-in fade-in duration-300">
      
      {/* 1. HERO SECTION (Visuals + Actions) */}
      <GameHero game={game}>
         <GameActions 
            gameId={game.id}
            onShare={() => setIsShareOpen(true)}
            onEdit={() => setIsEditOpen(true)}
            onDelete={() => setShowDeleteModal(true)}
         />
      </GameHero>

      {/* 2. TABS NAVIGATION */}
      <div id="game-details-tabs" className="border-b sticky top-0 bg-background/95 backdrop-blur z-20 pt-2">
         <div className="max-w-[1600px] w-full mx-auto px-10 flex gap-8">
            {['overview', 'sessions', 'reviews', 'achievements'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                        "pb-3 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2",
                        activeTab === tab 
                            ? "border-primary text-primary" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {tab}
                    {tab === 'achievements' && achievements.length > 0 && (
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-black",
                            activeTab === 'achievements' 
                                ? "bg-primary/20 text-primary" 
                                : "bg-muted text-muted-foreground"
                        )}>
                            {unlockedAchievements}/{achievements.length}
                        </span>
                    )}
                </button>
            ))}
         </div>
      </div>

      {/* 3. MAIN GRID */}
      <div className="p-10 pt-14 pb-20 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-y-12">
         
         {/* LEFT COLUMN: Dynamic Content */}
         <div className="lg:col-span-2 min-h-[400px]">
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                    {/* Summary */}
                    {game.summary && (
                        <section>
                            <h2 className="text-xl font-bold mb-3">About</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg">
                                {game.summary}
                            </p>
                        </section>
                    )}
                    
                    {/* Storyline */}
                    {game.storyline && (
                        <section className="bg-muted/30 p-6 rounded-xl border-l-4 border-primary">
                            <h3 className="font-bold text-sm uppercase text-muted-foreground mb-2">Plot</h3>
                            <p className="italic text-muted-foreground">{game.storyline}</p>
                        </section>
                    )}

                    {/* Time To Beat Widget */}
                    {metadata.timeToBeat && (
                        <div className="grid grid-cols-3 gap-4">
                             <div className="bg-card border p-4 rounded-xl text-center">
                                 <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Main Story</div>
                                 <div className="text-xl font-black">{formatPlaytime(metadata.timeToBeat.normally)}</div>
                             </div>
                             <div className="bg-card border p-4 rounded-xl text-center">
                                 <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Main + Extra</div>
                                 <div className="text-xl font-black">{formatPlaytime(metadata.timeToBeat.hastily)}</div>
                             </div>
                             <div className="bg-card border p-4 rounded-xl text-center">
                                 <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Completionist</div>
                                 <div className="text-xl font-black">{formatPlaytime(metadata.timeToBeat.completely)}</div>
                             </div>
                        </div>
                    )}

                    {/* DLCs List (Owned Items from Local DB) */}
                    <DlcList items={game.linked_dlcs} />
                </div>
            )}

            {activeTab === 'sessions' && <SessionsTab game={game} />}
            
            {activeTab === 'reviews' && (
                <ReviewsTab game={game} onUpdate={(g) => setGame(g)} />
            )}

            {activeTab === 'achievements' && (
                <AchievementsTab game={game} achievements={achievements} loading={achievementsLoading} onRefresh={refreshAchievements} />
            )}
         </div>

         {/* RIGHT COLUMN: Metadata (Fixed) */}
         <div className="space-y-6">
            <GameMetadata game={game} metadata={metadata} />
         </div>
      </div>

      {/* 4. MODALS */}
      <EditGameModal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        game={game} 
        onSave={handleUpdateGame}
        onSaveSuccess={loadGame}
      />
      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} game={game} />
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={executeDelete}
        title={`Delete "${game.name}"?`}
        message="Are you sure you want to remove this game from your library?"
        confirmText="Delete Game"
        isDanger={true}
      />
    </div>
  );
};
