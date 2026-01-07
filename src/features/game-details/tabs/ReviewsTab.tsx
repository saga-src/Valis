
import React, { useState, useMemo } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { ReviewEditor } from '../../reviews/ReviewEditor';

interface ReviewsTabProps {
  game: any;
  onUpdate: (updatedGame: any) => void;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ game, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  // STRICT MAPPING: Use game.rating (IGDB) only
  const igdbRating = game.rating ? Math.round(game.rating) : 0;

  // Verdict Logic
  const getVerdict = (score: number) => {
      if (score >= 90) return "Universal Acclaim. This title is considered a masterpiece.";
      if (score >= 75) return "Generally Favorable. Most players enjoy this title.";
      if (score > 0) return "Mixed or Average. Opinions are split on this one.";
      return "No Rating Available. Be the first to review!";
  };

  // Check if a review actually exists (beyond empty default)
  const hasReview = useMemo(() => {
    if (!game.review_metadata) return false;
    if (game.review_metadata === '{}') return false;
    try {
        const parsed = typeof game.review_metadata === 'string' ? JSON.parse(game.review_metadata) : game.review_metadata;
        const result = !!(parsed.method || (parsed.criteria_scores && Object.keys(parsed.criteria_scores).length > 0));
        return result;
    } catch (e) {
        console.error('[Wrapper] Metadata parse error:', e);
        return false;
    }
  }, [game.review_metadata]);

  // If a review exists or the user wants to write one, show the Editor
  if (hasReview || isEditing) {
    return <ReviewEditor game={game} onUpdate={onUpdate} />;
  }

  // Otherwise, show the placeholder call-to-action with Community stats
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Community Rating Box (Read Only Context - IGDB Only) */}
      <div className="bg-card border rounded-xl p-6 flex items-center gap-6 shadow-sm">
        <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg min-w-[100px]">
          <span className="text-4xl font-black text-foreground">
             {igdbRating > 0 ? igdbRating : '-'}
          </span>
          <div className="flex text-yellow-500 mt-1">
             {[...Array(5)].map((_, i) => (
               <Star key={i} size={16} fill="currentColor" className={igdbRating > 0 && i < Math.round(igdbRating / 20) ? "opacity-100" : "opacity-30"} />
             ))}
          </div>
          <span className="text-xs text-muted-foreground mt-2">IGDB Score</span>
        </div>

        <div className="flex-1 space-y-2">
           <h3 className="font-bold">Community Reception</h3>
           <p className="text-sm text-muted-foreground">
             {getVerdict(igdbRating)}
           </p>
        </div>
      </div>

      {/* No Review Placeholder */}
      <div className="bg-card border border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors group">
         <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
            <MessageSquare className="text-muted-foreground group-hover:text-primary transition-colors" size={24} />
         </div>
         <h3 className="font-bold text-lg mb-2">No Review Yet</h3>
         <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            You haven't analyzed this game yet. Start a Casual or Critical analysis to determine your final score and generate a verdict card.
         </p>
         <button 
            onClick={() => {
                setIsEditing(true);
            }}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
         >
            Write Review
         </button>
      </div>
    </div>
  );
};
