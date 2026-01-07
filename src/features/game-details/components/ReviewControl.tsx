
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface ReviewControlProps {
  game: any;
  onSubmit: (game: any, rating: number, reviewText: string) => Promise<boolean | void>;
}

export const ReviewControl: React.FC<ReviewControlProps> = ({ game, onSubmit }) => {
  // Use existing user_rating if available, otherwise default to 0
  const [rating, setRating] = useState(game.user_rating || 0);
  const [text, setText] = useState(game.review_text || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(game, rating, text);
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
      <h3 className="font-bold text-sm uppercase text-muted-foreground">Rate & Review</h3>
      
      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button 
            key={star} 
            onClick={() => setRating(star)}
            className="focus:outline-none transition-transform active:scale-90"
          >
            <Star 
              size={24} 
              className={cn(
                "transition-colors",
                star <= rating 
                  ? "fill-yellow-500 text-yellow-500" 
                  : "text-muted-foreground hover:text-yellow-500/50"
              )} 
            />
          </button>
        ))}
      </div>

      {/* Text */}
      <textarea 
        className="w-full bg-background border border-border rounded-md p-3 text-sm min-h-[80px] resize-y focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
        placeholder="What did you think?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button 
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isSubmitting ? 'Publishing...' : 'Publish Review'}
      </button>
    </div>
  );
};
