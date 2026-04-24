import { useEffect, useRef, useState } from 'react';

/**
 * Fast-typing text input bound to a URL search param.
 *
 * Binding `<input value>` directly to a `useSearchParams()` value forces a
 * `router.replace()` on every keystroke; Next.js App Router then re-resolves
 * the route, and on slower machines (or with heavy pages) keydown events
 * get dropped while the main thread is busy. This hook keeps the input on
 * instant local state and syncs to the URL after the user pauses typing,
 * so the filter is live but navigation work is deferred.
 *
 * `urlValue` should be the current parsed param (e.g. `searchParams.get('dmq') ?? ''`);
 * `write` is called with the debounced value (null to clear the param).
 */
export function useDebouncedUrlParam(
  urlValue: string,
  write: (value: string | null) => void,
  debounceMs: number = 250
): [string, (next: string) => void] {
  const [local, setLocal] = useState(urlValue);

  // Pin the write callback via ref so a parent re-render (which gives us a
  // new write function identity) doesn't reset the debounce timer.
  const writeRef = useRef(write);
  writeRef.current = write;

  // Back/forward, deep links, or any other caller that mutates the URL
  // should win over stale local state.
  useEffect(() => {
    setLocal((prev) => (prev === urlValue ? prev : urlValue));
  }, [urlValue]);

  // Debounced local -> URL sync. Skipped when already in sync so the
  // debounced write immediately after a back-button restore is a no-op.
  useEffect(() => {
    if (local === urlValue) return;
    const id = setTimeout(() => writeRef.current(local ? local : null), debounceMs);
    return () => clearTimeout(id);
  }, [local, urlValue, debounceMs]);

  return [local, setLocal];
}
