'use client';

import { useEffect, useState } from 'react';

const CELEBRATION_IMAGE_URL = '/domainfinancial.png';

/**
 * Loads the shared celebration PNG that the domain-sale share cards
 * overlay their text on. Returns null until the image has finished
 * loading (and null permanently if loading errors), so callers can
 * fall through to the gradient-card layout.
 */
export function useCelebrationImage(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = CELEBRATION_IMAGE_URL;
  }, []);

  return image;
}
