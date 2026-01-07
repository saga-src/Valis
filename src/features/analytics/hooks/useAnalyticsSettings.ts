import { useState, useEffect } from 'react';

export type AnalyticsLayout = 'overview' | 'deep-dive' | 'habits';
export type AnalyticsWidget = 'status' | 'radar' | 'scatter' | 'heatmap' | 'era' | 'value';

interface LayoutConfig {
  visibleWidgets: Record<AnalyticsWidget, boolean>;
}

const DEFAULTS: Record<AnalyticsLayout, LayoutConfig> = {
  overview: {
    visibleWidgets: {
      status: true,
      value: true,
      heatmap: true,
      radar: false,
      scatter: false,
      era: false
    }
  },
  'deep-dive': {
    visibleWidgets: {
      status: false,
      value: false,
      heatmap: false,
      radar: true,
      scatter: true,
      era: true
    }
  },
  habits: {
    visibleWidgets: {
      status: false,
      value: false,
      heatmap: true,
      radar: true,
      scatter: false,
      era: false
    }
  }
};

export const useAnalyticsSettings = () => {
  const [activeLayout, setActiveLayout] = useState<AnalyticsLayout>('overview');
  const [layouts, setLayouts] = useState<Record<AnalyticsLayout, LayoutConfig>>(() => {
    try {
      const saved = localStorage.getItem('analytics_layouts');
      return saved ? JSON.parse(saved) : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // Persist on change
  useEffect(() => {
    localStorage.setItem('analytics_layouts', JSON.stringify(layouts));
  }, [layouts]);

  const toggleWidget = (widget: AnalyticsWidget) => {
    setLayouts(prev => ({
      ...prev,
      [activeLayout]: {
        ...prev[activeLayout],
        visibleWidgets: {
          ...prev[activeLayout].visibleWidgets,
          [widget]: !prev[activeLayout].visibleWidgets[widget]
        }
      }
    }));
  };

  const resetSettings = () => {
    setLayouts(DEFAULTS);
  };

  return {
    activeLayout,
    setActiveLayout,
    visibleWidgets: layouts[activeLayout].visibleWidgets,
    toggleWidget,
    resetSettings
  };
};