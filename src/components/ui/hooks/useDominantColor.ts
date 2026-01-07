import { useState, useEffect } from 'react';
// @ts-ignore
import ColorThief from 'colorthief';

export const useDominantColor = (imageUrl: string | undefined) => {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    let isMounted = true;

    img.onload = () => {
      if (!isMounted) return;
      try {
        const colorThief = new ColorThief();
        const result = colorThief.getColor(img);
        // Convert [R, G, B] to "rgb(r, g, b)" string
        if (result) {
          setColor(`rgb(${result[0]}, ${result[1]}, ${result[2]})`);
        }
      } catch (e) {
        console.warn('Failed to extract color', e);
      }
    };

    img.onerror = () => {
      if (!isMounted) return;
      console.warn('Failed to load image for color extraction:', imageUrl);
    };

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return color;
};