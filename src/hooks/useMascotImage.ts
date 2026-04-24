'use client';

import { useEffect, useState } from 'react';

export interface MascotImages {
  /** Celebrating bull for profitable sales / portfolios. */
  happy: HTMLImageElement | null;
  /** Dejected bull for losses. Keeps personality without being tone-deaf. */
  sad: HTMLImageElement | null;
}

const HAPPY_URL = '/domainfinancialpng.png';
const SAD_URL = '/mascot-sad.png';

function load(url: string, onDone: (img: HTMLImageElement | null) => void) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => onDone(img);
  img.onerror = () => onDone(null);
  img.src = url;
}

/**
 * Loads both mascot PNGs once on mount and returns them. Callers pick
 * which one to pass to the canvas based on whether the underlying data
 * (per-sale or aggregate portfolio) is up or down.
 */
export function useMascotImage(): MascotImages {
  const [happy, setHappy] = useState<HTMLImageElement | null>(null);
  const [sad, setSad] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    load(HAPPY_URL, setHappy);
    load(SAD_URL, setSad);
  }, []);

  return { happy, sad };
}
