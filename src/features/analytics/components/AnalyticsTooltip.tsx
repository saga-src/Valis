import React from 'react';
import { cn } from '../../../lib/utils/cn';

export const analyticsTooltipProps = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    color: 'hsl(var(--popover-foreground))',
    boxShadow: '0 12px 30px rgb(0 0 0 / 0.24)',
    fontSize: '0.75rem'
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 700 },
  itemStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600 },
  wrapperStyle: { zIndex: 60, outline: 'none' }
} as const;

export const AnalyticsTooltipSurface = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={cn('max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-2xl', className)}>
    {children}
  </div>
);
