import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { WIDGET_DEFINITIONS, DEFAULT_LAYOUT, getWidgetDef } from './charts/widgetRegistry';
import { AnalyticsProvider, useAnalyticsFilters } from "./AnalyticsContext";
import { cn } from '../../lib/utils/cn';
import * as Icons from 'lucide-react';

// --- Defensive Import Strategy ---
const Module = ReactGridLayout as any;

// Handle CommonJS vs ESM default exports
const RGL = Module.default || Module;
const ResponsiveGrid = Module.Responsive || RGL.Responsive;

/**
 * Custom Hook to track container width for proportional scaling
 */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

const DashboardContent = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track width for dynamic row height calculation
  const containerWidth = useContainerWidth(containerRef);
  
  // Use Context for Filters
  const { filters, setFilters } = useAnalyticsFilters();

  // Layout State
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('analytics_layout_v3'); 
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    } catch { return DEFAULT_LAYOUT; }
  });

  // Calculate dynamic row height to preserve aspect ratios
  // (ContainerWidth - Total Margins) / 12 Columns = Approx Col Width
  // rowHeight = Col Width * Multiplier (e.g. 0.6 for 16:10 feeling)
  const dynamicRowHeight = useMemo(() => {
    const MARGIN = 16;
    const COLS = 12;
    const totalMargin = MARGIN * (COLS + 1);
    const colWidth = (containerWidth - totalMargin) / COLS;
    // We want the rows to be roughly proportional to column width
    // Adjust 0.6 to change the "verticality" of the grid cells
    return Math.max(20, colWidth * 0.6); 
  }, [containerWidth]);

  useEffect(() => { setMounted(true); }, []);

  const onLayoutChange = useCallback((currentLayout: any) => {
    setLayout(currentLayout);
    localStorage.setItem('analytics_layout_v3', JSON.stringify(currentLayout));
  }, []);

  const resetLayout = () => {
    if (window.confirm("Reset dashboard layout to default?")) {
        setLayout(DEFAULT_LAYOUT);
        localStorage.setItem('analytics_layout_v3', JSON.stringify(DEFAULT_LAYOUT));
    }
  };

  // --- ADD WIDGET LOGIC ---
  const addWidget = (type: string) => {
    const def = WIDGET_DEFINITIONS[type];
    if (!def) return;

    // Generate Unique ID
    const newId = `${type}_${Date.now()}`;
    
    // Add to layout (put it at the bottom 0, Infinity)
    const newItem = {
        i: newId,
        x: 0,
        y: Infinity, // RGL handles placing it at the bottom
        w: def.defaultSize.w,
        h: def.defaultSize.h,
    };

    setLayout([...layout, newItem]);
    setShowAddMenu(false);
  };

  // --- REMOVE WIDGET LOGIC ---
  const removeWidget = (id: string) => {
    setLayout(layout.filter((l: any) => l.i !== id));
  };

  if (!mounted) return <div className="p-10">Loading...</div>;

  return (
    <div ref={containerRef} className="w-full min-h-screen p-6 space-y-6">
      
      {/* --- HEADER TOOLBAR --- */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-4 border-b border-white/5">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-white">Analytics</h2>
           <p className="text-sm text-muted-foreground mt-1">Deep dive into your collection and habits.</p>
        </div>

        <div className={cn("flex flex-col sm:flex-row gap-4 items-center transition-opacity duration-500", !isEditing && "opacity-80 hover:opacity-100")}>
            {/* Global Filters */}
            <div className="flex items-center gap-3 bg-card/50 border border-white/10 rounded-xl p-2 px-3 shadow-sm">
                <Icons.Filter size={16} className="text-muted-foreground shrink-0" />
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-white transition-colors select-none">
                    <input 
                        type="checkbox" 
                        checked={filters.excludeFree} 
                        onChange={(e) => setFilters(prev => ({ ...prev, excludeFree: e.target.checked }))} 
                        className="accent-primary" 
                    />
                    No Free
                </label>
                <div className="w-px h-4 bg-white/10"></div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-white transition-colors select-none">
                    <input 
                        type="checkbox" 
                        checked={filters.officialOnly} 
                        onChange={(e) => setFilters(prev => ({ ...prev, officialOnly: e.target.checked }))} 
                        className="accent-primary" 
                    />
                    Official Only
                </label>
            </div>

            {/* Edit / Add Controls */}
            <div className="flex items-center gap-2 relative">
                {isEditing && (
                     <div className="relative">
                        <button 
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 transition-all font-bold text-sm"
                        >
                            <Icons.Plus size={16} /> Add Widget
                        </button>
                        
                        {/* Add Widget Dropdown */}
                        {showAddMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-[100] p-2 grid gap-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">Available Widgets</span>
                                {Object.values(WIDGET_DEFINITIONS).map((def) => (
                                    <button
                                        key={def.id}
                                        onClick={() => addWidget(def.id)}
                                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left transition-colors"
                                    >
                                        <div className="p-1.5 bg-white/5 rounded-md">
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
                    "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-bold",
                    isEditing 
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.2)]" 
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    )}
                >
                    <Icons.LayoutGrid size={16} />
                    {isEditing ? 'Done' : 'Customize'}
                </button>
                
                {isEditing && (
                    <button onClick={resetLayout} className="p-2 hover:text-red-400 text-muted-foreground transition-colors" title="Reset Layout">
                        <Icons.RotateCcw size={16} />
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* --- THE GRID --- */}
      <ResponsiveGrid
        className={cn("layout", isEditing && "is-editing")}
        // Lock layout for all desktop breakpoints to prevent shuffling
        layouts={{ lg: layout, md: layout, sm: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        // Lock column count to 12 for scaling, only stack on mobile (xs)
        cols={{ lg: 12, md: 12, sm: 12, xs: 1, xxs: 1 }}
        width={containerWidth}
        rowHeight={dynamicRowHeight}
        isDraggable={isEditing && containerWidth >= 768}
        isResizable={isEditing && containerWidth >= 768}
        onLayoutChange={onLayoutChange}
        margin={[16, 16]}
        draggableHandle=".drag-handle"
      >
        {layout.map((item: any) => {
          const widgetDef = getWidgetDef(item.i);
          if (!widgetDef) return <div key={item.i} />;
          
          const Component = widgetDef.component;
          const isStatCard = widgetDef.isStatCard;

          return (
            <div key={item.i} className={cn(
              "relative rounded-xl overflow-hidden flex flex-col transition-all duration-300",
              
              // BASE STYLE (Wrapper is the Card)
              "bg-card border border-border/50 shadow-sm",
              
              // EDIT MODE
              isEditing && "ring-2 ring-cyan-500/50 z-50 shadow-2xl",
              
              // IMMERSIVE MODE (Glassmorphism & Clean)
              !isEditing && [
                "!bg-black/20 !border-white/5 backdrop-blur-md !shadow-none",
                "hover:scale-[1.01] hover:!bg-black/30 hover:!border-white/10 hover:shadow-2xl hover:z-10",
                // Strip inner styles to prevent double-carding
                "[&_.bg-card]:!bg-transparent [&_.bg-card]:!border-none [&_.bg-card]:!shadow-none"
              ]
            )}>
              {/* Drag Handle / Header */}
              <div className={cn(
                "drag-handle flex items-center justify-between px-3 py-2 border-b select-none transition-opacity",
                "bg-muted/30 border-border/50 text-foreground/80 dark:bg-white/5 dark:border-white/5",
                isEditing ? "cursor-move opacity-100" : (isStatCard ? "hidden" : "opacity-0 h-0 p-0 border-0") // Hide wrapper header in immersive if stat card OR standard widget (rely on internal header)
              )}>
                <span className="text-[10px] font-bold uppercase tracking-widest truncate opacity-70">{widgetDef.title}</span>
                {isEditing && (
                    <div className="flex gap-2">
                         <button 
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => removeWidget(item.i)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                         >
                            <Icons.X size={12} />
                         </button>
                    </div>
                )}
              </div>

              {/* Content */}
              <div className={cn("flex-1 min-h-0 w-full h-full overflow-hidden relative", isStatCard ? "p-0" : "p-0")}>
                 <Component />
                 {isEditing && <div className="absolute inset-0 z-10 bg-transparent cursor-move" />}
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
};

export const AnalyticsDashboard = () => (
  <AnalyticsProvider>
    <DashboardContent />
  </AnalyticsProvider>
);
export default AnalyticsDashboard;