
import React from 'react';
import { HeatmapWidget as ActivityHeatmap } from '../charts/HeatmapWidget';
import { RadarWidget as GenreRadar } from '../charts/RadarWidget';
import { EraWidget as PlaytimeLine } from '../charts/EraWidget';
import { CompletionWidget } from '../charts/CompletionWidget';
import { CircadianWidget } from '../charts/CircadianWidget';
import { BurnDownWidget } from '../charts/BurnDownWidget';
import { GenreStreamWidget } from '../charts/GenreStreamWidget';
import { TemporalProjectionWidget } from '../charts/TemporalProjectionWidget';
// import { HardwareWidget } from '../../../components/widgets/HardwareWidget'; -- Disabled due to performance lag (v1.0)
import { SocialFeed } from '../../social/components/SocialFeed';
import { useCoreAnalytics } from '../hooks/useCoreAnalytics';
import { useHeatmapData } from '../hooks/useHeatmapData';

// New Stat Widgets
import { 
    WidgetTotalPlaytime, 
    WidgetSessionsLogged, 
    WidgetBeatRate,
    WidgetAvgSession,
    WidgetLibraryValue,
    WidgetCostPerHour
} from './StatusWidget';

// --- Wrapper Components to provide data context ---

const ConnectedHeatmap = () => {
  const { sessions } = useCoreAnalytics();
  const data = useHeatmapData(sessions);
  const start = new Date(); 
  start.setFullYear(start.getFullYear() - 1);
  return <ActivityHeatmap data={data} startDate={start} endDate={new Date()} />;
};

const ConnectedRadar = () => {
  const { library } = useCoreAnalytics();
  return <GenreRadar library={library} />;
};

const ConnectedCompletion = () => {
  const { library } = useCoreAnalytics();
  return <CompletionWidget library={library} />;
};

const ConnectedEra = () => {
  const { library } = useCoreAnalytics();
  return <PlaytimeLine library={library} />;
};

const ConnectedCircadian = () => {
  const { sessions } = useCoreAnalytics();
  return <CircadianWidget sessions={sessions} />;
};

const ConnectedBurnDown = () => {
  const { library, sessions } = useCoreAnalytics();
  return <BurnDownWidget library={library} sessions={sessions} />;
};

const ConnectedStream = () => {
  const { library, sessions } = useCoreAnalytics();
  return <GenreStreamWidget library={library} sessions={sessions} />;
};

const ConnectedProjection = () => {
  const { library, sessions } = useCoreAnalytics();
  return <TemporalProjectionWidget library={library} sessions={sessions} />;
};

// HardwareWidget handles its own data fetching via useSystemMonitor
// SocialFeed handles its own data fetching via Supabase

export interface WidgetDef {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  defaultSize: { w: number; h: number }; 
  minSize?: { w: number; h: number };
  isStatCard?: boolean; // Helper flag for styling
}

export const WIDGET_DEFINITIONS: Record<string, WidgetDef> = {
  // --- STAT CARDS ---
  'stat_playtime': {
      id: 'stat_playtime', title: 'Total Playtime', component: WidgetTotalPlaytime,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
  'stat_sessions': {
      id: 'stat_sessions', title: 'Total Sessions', component: WidgetSessionsLogged,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
  'stat_library_value': {
      id: 'stat_library_value', title: 'Library Value', component: WidgetLibraryValue,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
  'stat_cost_hour': {
      id: 'stat_cost_hour', title: 'Cost / Hour', component: WidgetCostPerHour,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
  'stat_beat_rate': {
      id: 'stat_beat_rate', title: 'Beat Rate', component: WidgetBeatRate,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
   'stat_avg_session': {
      id: 'stat_avg_session', title: 'Avg Session', component: WidgetAvgSession,
      defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: true
  },
  'temporal_projection': {
      id: 'temporal_projection', title: 'Backlog Forecast', component: ConnectedProjection,
      defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 2 }, isStatCard: false
  },

  // --- CHARTS ---
  'activity_heatmap': {
    id: 'activity_heatmap', title: 'Session Activity', component: ConnectedHeatmap,
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 4 }
  },
  'genre_radar': {
    id: 'genre_radar', title: 'Genre DNA', component: ConnectedRadar,
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }
  },
  'playtime_history': {
    id: 'playtime_history', title: 'Timeline', component: ConnectedEra,
    defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }
  },
  'completion_status': {
    id: 'completion_status', title: 'Completion Rates', component: ConnectedCompletion,
    defaultSize: { w: 4, h: 3 },
  },
  'circadian_rhythm': {
    id: 'circadian_rhythm', title: 'Circadian Rhythm', component: ConnectedCircadian,
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }
  },
  'backlog_burndown': {
    id: 'backlog_burndown', title: 'Backlog History', component: ConnectedBurnDown,
    defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }
  },
  'genre_evolution': {
    id: 'genre_evolution', title: 'Genre Evolution', component: ConnectedStream,
    defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 3 }
  },
  /* 'system_monitor': {
    id: 'system_monitor', title: 'Neural Link', component: HardwareWidget,
    defaultSize: { w: 3, h: 2 },
  }, -- Disabled due to performance lag (v1.0) */
  // --- SOCIAL ---
  'social_feed': {
    id: 'social_feed', title: 'Community Feed', component: SocialFeed,
    defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 4 }
  }
};

export const getWidgetDef = (id: string): WidgetDef | undefined => {
    // If ID contains timestamp (instance ID), strip it to find def
    const type = id.split('_').filter(part => isNaN(Number(part))).join('_');
    return WIDGET_DEFINITIONS[type] || Object.values(WIDGET_DEFINITIONS).find(w => id.startsWith(w.id));
};

export const DEFAULT_LAYOUT = [
  // Row 1: Stat Cards (spanning 12 columns)
  { i: 'stat_playtime',      x: 0, y: 0, w: 2, h: 2 },
  { i: 'stat_sessions',      x: 2, y: 0, w: 2, h: 2 },
  { i: 'stat_library_value', x: 4, y: 0, w: 2, h: 2 },
  { i: 'stat_cost_hour',     x: 6, y: 0, w: 2, h: 2 },
  { i: 'stat_beat_rate',     x: 8, y: 0, w: 2, h: 2 },
  { i: 'stat_avg_session',   x: 10, y: 0, w: 2, h: 2 },
  
  // Row 2: Charts
  { i: 'backlog_burndown',   x: 0, y: 2, w: 8, h: 4 },
  { i: 'temporal_projection',x: 8, y: 2, w: 4, h: 2 },
  // { i: 'system_monitor',     x: 8, y: 4, w: 4, h: 2 }, -- Hidden by default to prevent lag

  // Row 3: Secondary Charts
  { i: 'genre_radar',        x: 0, y: 6, w: 4, h: 4 },
  { i: 'genre_evolution',    x: 4, y: 6, w: 8, h: 4 },

  // Row 4: Deep Dive & Social
  { i: 'activity_heatmap',   x: 0, y: 10, w: 8, h: 4 },
  { i: 'social_feed',        x: 8, y: 10, w: 4, h: 6 }, // Updated to SocialFeed
  { i: 'circadian_rhythm',   x: 8, y: 16, w: 4, h: 4 },
];
