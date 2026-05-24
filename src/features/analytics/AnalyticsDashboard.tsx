import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { WIDGET_DEFINITIONS, DEFAULT_LAYOUT, getWidgetDef } from './charts/widgetRegistry';
import { AnalyticsProvider, useAnalyticsFilters } from './AnalyticsContext';
import { cn } from '../../lib/utils/cn';
import * as Icons from 'lucide-react';

const Module = ReactGridLayout as any;
const RGL = Module.default || Module;
const ResponsiveGrid = Module.Responsive || RGL.Responsive;

const ANALYTICS_LAYOUT_VERSION = 4;
const ANALYTICS_LAYOUT_STORAGE_KEY = 'analytics_layout_v4';
const LEGACY_ANALYTICS_LAYOUT_KEY = 'analytics_layout_v3';

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 10, sm: 6, xs: 2, xxs: 1 };
type Breakpoint = keyof typeof COLS;
type DashboardLayouts = Record<Breakpoint, any[]>;
const BREAKPOINT_KEYS = Object.keys(COLS) as Breakpoint[];

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    const update = () => setWidth(Math.max(0, Math.floor(ref.current?.clientWidth || 0)));
    update();

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width || 0;
      setWidth(Math.floor(next));
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

const getMinSize = (id: string) => {
  const def = getWidgetDef(id);
  return def?.minSize || def?.defaultSize || { w: 2, h: 2 };
};

const normalizeLayout = (input: any, cols = 12) => {
  const source = Array.isArray(input) ? input : DEFAULT_LAYOUT;
  const seen = new Set<string>();
  const result: any[] = [];

  source.forEach((raw: any, index: number) => {
    if (!raw || typeof raw.i !== 'string' || seen.has(raw.i) || !getWidgetDef(raw.i)) return;
    seen.add(raw.i);
    const min = getMinSize(raw.i);
    const w = Math.min(cols, Math.max(min.w, Number(raw.w) || min.w));
    const h = Math.max(min.h, Number(raw.h) || min.h);
    const x = Math.min(Math.max(0, Number(raw.x) || 0), Math.max(0, cols - w));
    const y = Math.max(0, Number.isFinite(Number(raw.y)) ? Number(raw.y) : index * h);

    result.push({
      i: raw.i,
      x,
      y,
      w,
      h,
      minW: Math.min(cols, min.w),
      minH: min.h,
    });
  });

  return result.length > 0 ? result : normalizeLayout(DEFAULT_LAYOUT, cols);
};

const stackLayout = (layout: any[], cols: number) => {
  let y = 0;
  return layout.map((item) => {
    const min = getMinSize(item.i);
    const h = Math.max(min.h, item.h);
    const next = {
      ...item,
      x: 0,
      y,
      w: cols,
      h,
      minW: cols,
      minH: min.h,
    };
    y += h;
    return next;
  });
};

const buildResponsiveLayouts = (layout: any[]): DashboardLayouts => ({
  lg: normalizeLayout(layout, COLS.lg),
  md: normalizeLayout(layout, COLS.md),
  sm: normalizeLayout(layout, COLS.sm),
  xs: stackLayout(normalizeLayout(layout, COLS.xs), COLS.xs),
  xxs: stackLayout(normalizeLayout(layout, COLS.xxs), COLS.xxs),
});

const normalizeResponsiveLayouts = (input?: Partial<DashboardLayouts>, fallbackLayout = DEFAULT_LAYOUT): DashboardLayouts => {
  const fallback = normalizeLayout(fallbackLayout, COLS.lg);
  return BREAKPOINT_KEYS.reduce((acc, breakpoint) => {
    const source = Array.isArray(input?.[breakpoint]) && input?.[breakpoint]?.length
      ? input[breakpoint]
      : fallback;
    const normalized = normalizeLayout(source, COLS[breakpoint]);
    acc[breakpoint] = breakpoint === 'xs' || breakpoint === 'xxs'
      ? stackLayout(normalized, COLS[breakpoint])
      : normalized;
    return acc;
  }, {} as DashboardLayouts);
};

const looksCollapsedForDesktop = (layout: any[]) => {
  if (!Array.isArray(layout) || layout.length < 4) return false;
  const normalized = normalizeLayout(layout, COLS.lg);
  const leftAligned = normalized.filter(item => Number(item.x) === 0).length / normalized.length;
  const widest = Math.max(...normalized.map(item => Number(item.w) || 0));
  return leftAligned > 0.8 && widest <= COLS.sm;
};

const reflowDesktopLayout = (layout: any[]) => {
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  return normalizeLayout(layout, COLS.lg).map((item) => {
    const def = getWidgetDef(item.i);
    const min = getMinSize(item.i);
    const desired = def?.defaultSize || { w: item.w, h: item.h };
    const w = Math.min(COLS.lg, Math.max(min.w, desired.w));
    const h = Math.max(min.h, desired.h);

    if (x + w > COLS.lg) {
      x = 0;
      y += rowHeight || h;
      rowHeight = 0;
    }

    const next = {
      ...item,
      x,
      y,
      w,
      h,
      minW: Math.min(COLS.lg, min.w),
      minH: min.h,
    };

    x += w;
    rowHeight = Math.max(rowHeight, h);
    return next;
  });
};

const loadInitialLayouts = () => {
  try {
    const saved = localStorage.getItem(ANALYTICS_LAYOUT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.version === ANALYTICS_LAYOUT_VERSION) {
        if (parsed.layouts) {
          const repairedLayouts = {
            ...parsed.layouts,
            lg: looksCollapsedForDesktop(parsed.layouts.lg)
              ? reflowDesktopLayout(parsed.layouts.lg)
              : parsed.layouts.lg,
          };
          return normalizeResponsiveLayouts(repairedLayouts);
        }

        if (parsed.layout) {
          const baseLayout = looksCollapsedForDesktop(parsed.layout)
            ? reflowDesktopLayout(parsed.layout)
            : parsed.layout;
          return buildResponsiveLayouts(baseLayout);
        }
      }
    }

    const legacy = localStorage.getItem(LEGACY_ANALYTICS_LAYOUT_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      return buildResponsiveLayouts(looksCollapsedForDesktop(parsed) ? reflowDesktopLayout(parsed) : parsed);
    }
  } catch (error) {
    console.warn('[Analytics] Saved layout was invalid and has been reset.', error);
  }
  return buildResponsiveLayouts(DEFAULT_LAYOUT);
};

const persistLayouts = (layouts: DashboardLayouts) => {
  localStorage.setItem(ANALYTICS_LAYOUT_STORAGE_KEY, JSON.stringify({
    version: ANALYTICS_LAYOUT_VERSION,
    layouts: normalizeResponsiveLayouts(layouts),
  }));
};

const DashboardContent = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [layouts, setLayouts] = useState<DashboardLayouts>(loadInitialLayouts);
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint>('lg');
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const { filters, setFilters, loading } = useAnalyticsFilters();

  const activeCols = containerWidth >= BREAKPOINTS.lg
    ? COLS.lg
    : containerWidth >= BREAKPOINTS.md
      ? COLS.md
      : containerWidth >= BREAKPOINTS.sm
        ? COLS.sm
        : containerWidth >= BREAKPOINTS.xs
          ? COLS.xs
          : COLS.xxs;

  const rowHeight = useMemo(() => {
    if (containerWidth < BREAKPOINTS.sm) return 86;
    const margin = 16;
    const colWidth = (Math.max(containerWidth, 320) - margin * (activeCols + 1)) / activeCols;
    return Math.max(52, Math.min(92, colWidth * 0.55));
  }, [activeCols, containerWidth]);

  const responsiveLayouts = useMemo(() => normalizeResponsiveLayouts(layouts), [layouts]);
  const canonicalLayout = responsiveLayouts.lg;

  useEffect(() => { setMounted(true); }, []);

  const onLayoutChange = useCallback((currentLayout: any, allLayouts?: Partial<DashboardLayouts>) => {
    if (!isEditing || containerWidth < BREAKPOINTS.sm) return;

    const incomingLayouts = allLayouts && Object.keys(allLayouts).length > 0
      ? allLayouts
      : { [activeBreakpoint]: currentLayout };
    const next = normalizeResponsiveLayouts({ ...layouts, ...incomingLayouts });
    setLayouts(next);
    persistLayouts(next);
  }, [activeBreakpoint, containerWidth, isEditing, layouts]);

  const resetLayout = () => {
    if (window.confirm('Reset dashboard layout to default?')) {
      const next = buildResponsiveLayouts(DEFAULT_LAYOUT);
      setLayouts(next);
      persistLayouts(next);
    }
  };

  const addWidget = (type: string) => {
    const def = WIDGET_DEFINITIONS[type];
    if (!def) return;

    const newId = `${type}_${Date.now()}`;
    const next = BREAKPOINT_KEYS.reduce((acc, breakpoint) => {
      const source = responsiveLayouts[breakpoint] || canonicalLayout;
      const y = source.reduce((max, item) => Math.max(max, Number(item.y || 0) + Number(item.h || 0)), 0);
      const cols = COLS[breakpoint];
      const withWidget = normalizeLayout([
        ...source,
        {
          i: newId,
          x: 0,
          y,
          w: Math.min(cols, def.defaultSize.w),
          h: def.defaultSize.h,
        },
      ], cols);

      acc[breakpoint] = breakpoint === 'xs' || breakpoint === 'xxs'
        ? stackLayout(withWidget, cols)
        : withWidget;
      return acc;
    }, {} as DashboardLayouts);

    setLayouts(next);
    persistLayouts(next);
    setShowAddMenu(false);
  };

  const removeWidget = (id: string) => {
    const next = BREAKPOINT_KEYS.reduce((acc, breakpoint) => {
      const filtered = responsiveLayouts[breakpoint].filter((item: any) => item.i !== id);
      const normalized = normalizeLayout(filtered, COLS[breakpoint]);
      acc[breakpoint] = breakpoint === 'xs' || breakpoint === 'xxs'
        ? stackLayout(normalized, COLS[breakpoint])
        : normalized;
      return acc;
    }, {} as DashboardLayouts);

    setLayouts(next);
    persistLayouts(next);
  };

  return (
    <div ref={containerRef} className="w-full min-h-screen p-4 sm:p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-4 border-b border-border/60">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Deep dive into your collection and habits.</p>
        </div>

        <div className={cn('flex flex-col sm:flex-row gap-3 items-stretch sm:items-center transition-opacity duration-500', !isEditing && 'opacity-90 hover:opacity-100')}>
          <div className="flex flex-wrap items-center gap-3 bg-card/70 border border-border rounded-lg p-2 px-3 shadow-sm">
            <Icons.Filter size={16} className="text-muted-foreground shrink-0" />
            <select
              value={filters.timeRange}
              onChange={(event) => setFilters(prev => ({ ...prev, timeRange: event.target.value as any }))}
              className="bg-transparent text-xs font-bold uppercase text-muted-foreground outline-none"
            >
              <option value="all">All Time</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors select-none">
              <input
                type="checkbox"
                checked={filters.excludeFree}
                onChange={(event) => setFilters(prev => ({ ...prev, excludeFree: event.target.checked }))}
                className="accent-primary"
              />
              No Free
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors select-none">
              <input
                type="checkbox"
                checked={filters.officialOnly}
                onChange={(event) => setFilters(prev => ({ ...prev, officialOnly: event.target.checked }))}
                className="accent-primary"
              />
              Official Only
            </label>
          </div>

          <div className="flex items-center gap-2 relative">
            {isEditing && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/25 transition-all font-bold text-sm"
                >
                  <Icons.Plus size={16} /> Add Widget
                </button>

                {showAddMenu && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-2xl z-[100] p-2 grid gap-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">Available Widgets</span>
                    {Object.values(WIDGET_DEFINITIONS).map((def) => (
                      <button
                        key={def.id}
                        onClick={() => addWidget(def.id)}
                        className="flex items-center gap-3 p-2 hover:bg-muted rounded-md text-left transition-colors"
                      >
                        <div className="p-1.5 bg-muted rounded-md">
                          {def.isStatCard ? <Icons.CreditCard size={14} /> : <Icons.BarChart size={14} />}
                        </div>
                        <span className="text-sm font-medium">{def.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-bold',
                isEditing
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <Icons.LayoutGrid size={16} />
              {isEditing ? 'Done' : 'Customize'}
            </button>

            {isEditing && (
              <button onClick={resetLayout} className="p-2 hover:text-red-500 text-muted-foreground transition-colors" title="Reset Layout">
                <Icons.RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {(!mounted || containerWidth === 0) ? (
        <div className="p-10 text-center text-muted-foreground">Loading dashboard...</div>
      ) : (
        <ResponsiveGrid
          className={cn('layout', isEditing && 'is-editing')}
          layouts={responsiveLayouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          width={containerWidth}
          rowHeight={rowHeight}
          isDraggable={isEditing && containerWidth >= BREAKPOINTS.sm}
          isResizable={isEditing && containerWidth >= BREAKPOINTS.sm}
          onLayoutChange={onLayoutChange}
          onBreakpointChange={(breakpoint: string) => setActiveBreakpoint(breakpoint as Breakpoint)}
          margin={[16, 16]}
          compactType="vertical"
          draggableHandle=".drag-handle"
        >
          {canonicalLayout.map((item: any) => {
            const widgetDef = getWidgetDef(item.i);
            if (!widgetDef) return <div key={item.i} />;

            const Component = widgetDef.component;
            const isStatCard = widgetDef.isStatCard;

            return (
              <div key={item.i} className={cn(
                'relative rounded-lg overflow-hidden flex flex-col transition-all duration-300',
                'bg-card border border-border/60 shadow-sm',
                isEditing && 'ring-2 ring-cyan-500/50 z-50 shadow-2xl',
                !isEditing && [
                  'hover:scale-[1.005] hover:border-primary/30 hover:shadow-lg hover:z-10',
                  '[&_.bg-card]:!bg-transparent [&_.bg-card]:!border-none [&_.bg-card]:!shadow-none'
                ]
              )}>
                <div className={cn(
                  'drag-handle flex items-center justify-between px-3 py-2 border-b select-none transition-opacity',
                  'bg-muted/40 border-border/60 text-foreground/80',
                  isEditing ? 'cursor-move opacity-100' : (isStatCard ? 'hidden' : 'opacity-0 h-0 p-0 border-0')
                )}>
                  <span className="text-[10px] font-bold uppercase tracking-widest truncate opacity-70">{widgetDef.title}</span>
                  {isEditing && (
                    <button
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => removeWidget(item.i)}
                      className="text-red-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Icons.X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 w-full h-full overflow-hidden relative">
                  {loading && <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70 animate-pulse z-20" />}
                  <Component />
                  {isEditing && <div className="absolute inset-0 z-10 bg-transparent cursor-move" />}
                </div>
              </div>
            );
          })}
        </ResponsiveGrid>
      )}
    </div>
  );
};

export const AnalyticsDashboard = () => (
  <AnalyticsProvider>
    <DashboardContent />
  </AnalyticsProvider>
);

export default AnalyticsDashboard;
