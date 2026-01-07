import React, { useMemo } from 'react';

interface TourSpotlightProps {
  /** Pre-calculated DOMRect of the element to highlight */
  targetRect: DOMRect | null;
  /** Extra space around the target element */
  padding?: number;
  /** Radius of the spotlight hole corners */
  borderRadius?: number;
}

/**
 * TourSpotlight
 * A pure SVG overlay component that creates a physical hole based on a provided DOMRect.
 */
export const TourSpotlight: React.FC<TourSpotlightProps> = ({
  targetRect,
  padding = 10,
  borderRadius = 8,
}) => {
  const windowSize = {
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  };

  const pathData = useMemo(() => {
    if (!targetRect) return '';

    const { width: vw, height: vh } = windowSize;
    
    // Spotlight Hole geometry
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const w = targetRect.width + padding * 2;
    const h = targetRect.height + padding * 2;
    const r = borderRadius;

    // Define the full screen rectangle
    const outer = `M 0,0 H ${vw} V ${vh} H 0 Z`;

    // Define the rounded rectangle cutout
    const hole = `
      M ${x + r},${y}
      h ${w - 2 * r}
      q ${r},0 ${r},${r}
      v ${h - 2 * r}
      q 0,${r} -${r},${r}
      h -${w - 2 * r}
      q -${r},0 -${r},-${r}
      v -${h - 2 * r}
      q 0,-${r} ${r},-${r}
      z
    `.trim();

    // Use "evenodd" fill rule to punch the hole
    return `${outer} ${hole}`;
  }, [targetRect, windowSize.width, windowSize.height, padding, borderRadius]);

  if (!targetRect) return null;

  return (
    <svg 
      className="fixed inset-0 z-[9998] w-full h-full pointer-events-none select-none overflow-visible"
      viewBox={`0 0 ${windowSize.width} ${windowSize.height}`}
    >
      <path
        d={pathData}
        fillRule="evenodd"
        className="fill-black/75 pointer-events-auto cursor-default transition-all duration-300 ease-in-out" 
      />
    </svg>
  );
};

export default TourSpotlight;