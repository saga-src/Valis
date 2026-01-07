import React from 'react';
import { Link } from '../../../app/index';
import { formatCardTime, getTotalPlaytimeSeconds } from '../../../lib/utils/format';

interface DataRowProps {
  game: any;
}

export const DataRow: React.FC<DataRowProps> = ({ game }) => {
  const totalSeconds = getTotalPlaytimeSeconds(game);
  const releaseYear = game.first_release_date 
    ? new Date(game.first_release_date * 1000).getFullYear() 
    : '--';

  return (
    <Link
      to={`/game/${game.id}`}
      className="grid grid-cols-12 gap-4 px-4 py-1.5 border-b border-border/30 hover:bg-muted/30 transition-colors font-telemetry text-[11px] text-muted-foreground data-grid-row group"
    >
      <div className="col-span-5 text-foreground font-bold truncate group-hover:text-primary transition-colors">
        {game.name || game.title}
      </div>
      
      <div className="col-span-2 uppercase tracking-tighter truncate">
        {game.status}
      </div>
      
      <div className="col-span-2 font-mono">
        {formatCardTime(totalSeconds)}
      </div>
      
      <div className="col-span-2 text-right font-mono">
        {releaseYear}
      </div>
      
      <div className="col-span-1 text-right font-bold text-foreground/50 group-hover:text-foreground transition-colors">
        {game.final_score ? Number(game.final_score).toFixed(1) : '--'}
      </div>
    </Link>
  );
};