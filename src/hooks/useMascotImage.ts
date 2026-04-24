'use client';

import { useEffect, useState } from 'react';

/**
 * The celebratory bull-head mascot drawn in the upper-right of the share
 * card when a sale closes profitably. Source file lives at
 * `public/domainfinancialpng.png` (alpha-channel PNG extracted from the
 * original Domain.Financial illustration). Falls through to a 🎉 emoji
 * if the image can't load.
 */
const MASCOT_URL = '/domainfinancialpng.png';

export function useMascotImage(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = MASCOT_URL;
  }, []);

  return image;
}
