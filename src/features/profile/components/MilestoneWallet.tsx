
import React from 'react';
import { Medal } from 'lucide-react';
import { BadgeCard } from '../BadgeCard';
import { cn } from '../../../lib/utils/cn';

interface MilestoneWalletProps {
  badges: any[];
  title?: string;
  layout?: 'grid' | 'row';
}

export const MilestoneWallet: React.FC<MilestoneWalletProps> = ({ badges, title = "Milestone Wallet", layout = 'grid' }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Medal size={20} className="text-amber-500" />
        <h3 className="font-bold text-lg">{title}</h3>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
          {badges.length}
        </span>
      </div>

      {layout === 'row' ? (
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x px-1">
            {badges.map((badge) => (
            <div key={badge.id} className="snap-start shrink-0">
                <BadgeCard badge={badge} className="min-w-[260px] h-full" />
            </div>
            ))}
            
            {badges.length === 0 && (
                <div className="w-full py-12 text-center text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-lg bg-muted/5">
                    No milestones unlocked yet.
                </div>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 flex-1">
            {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} className="w-full h-auto" />
            ))}
             {badges.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-lg bg-muted/5">
                    No milestones unlocked yet.
                </div>
            )}
        </div>
      )}
    </div>
  );
};
