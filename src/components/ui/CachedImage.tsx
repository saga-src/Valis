
import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils/cn';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  gameId: string;
  className?: string;
  alt?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ src, gameId, className, alt, ...props }) => {
  const [finalSrc, setFinalSrc] = useState<string>(src); // Default to remote immediately (Instant Render)

  useEffect(() => {
    let isMounted = true;

    const checkLocal = async () => {
      try {
        // Just ask: "Do you have it?"
        if (window.api && window.api.getImagePath) {
            const localPath = await window.api.getImagePath(src, gameId);
            // If yes, switch to local. If no, stay on remote.
            if (isMounted && localPath) {
              setFinalSrc(localPath);
            }
        }
      } catch (error) {
        // Ignore errors, keep remote URL
      }
    };

    if (src && gameId) {
        checkLocal();
    }
    
    return () => { isMounted = false; };
  }, [src, gameId]);

  return (
    <img 
      src={finalSrc} 
      alt={alt || ""}
      className={className} 
      decoding="async"
      loading="lazy" 
      {...props} 
    />
  );
};
