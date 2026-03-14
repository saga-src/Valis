import React from 'react';
import { GENERAL_MARKS } from '../../gamification/logic/generalMarks';
import { GeneralMarkCard } from '../../gamification/components/GeneralMarkCard';
import { Database, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface ProtocolArtifactsWalletProps {
  artifactIds: string[];
  fullWidth?: boolean;
}

export const ProtocolArtifactsWallet: React.FC<ProtocolArtifactsWalletProps> = ({ artifactIds, fullWidth }) => {
  const unlockedMarks = GENERAL_MARKS.filter(mark => artifactIds.includes(mark.id));

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-6">
        <Database size={20} className="text-cyan-500" />
        <h3 className="font-bold text-lg">Protocol Artifacts</h3>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
            {unlockedMarks.length} / {GENERAL_MARKS.length}
        </span>
      </div>

      {unlockedMarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/5 p-6 text-center">
            <AlertTriangle size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-bold">No anomalies detected.</p>
            <p className="text-xs opacity-70 mt-1">System operating within normal parameters.</p>
        </div>
      ) : (
        <div className={cn(
            "grid gap-3", 
            fullWidth ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-6" : "grid-cols-2"
        )}>
             {unlockedMarks.map(mark => (
                 <GeneralMarkCard key={mark.id} mark={mark} isUnlocked={true} />
             ))}
        </div>
      )}
    </div>
  );
};
