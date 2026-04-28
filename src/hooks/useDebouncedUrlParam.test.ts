/**
 * Locks in the race we hit in the Domain Portfolio / Transaction History
 * search boxes: characters typed during the window between a debounce
 * write and the urlValue prop catching up were getting overwritten by
 * the URL→local effect rewinding local back to the just-synced URL.
 *
 * Each scenario walks through React renders manually via renderHook +
 * rerender so we can interleave urlValue prop updates and setLocal calls
 * the way the real app does, without spinning up a router.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedUrlParam } from './useDebouncedUrlParam';

describe('useDebouncedUrlParam', () => {
  it('initial mount with a URL value seeds local without firing the writer', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { result } = renderHook(({ url }) => useDebouncedUrlParam(url, write, 250), {
      initialProps: { url: 'cat' },
    });

    expect(result.current[0]).toBe('cat');
    act(() => { vi.advanceTimersByTime(500); });
    expect(write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('typing fires write once after the debounce window', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { result } = renderHook(({ url }) => useDebouncedUrlParam(url, write, 250), {
      initialProps: { url: '' },
    });

    act(() => { result.current[1]('a'); });
    act(() => { result.current[1]('ap'); });
    act(() => { result.current[1]('app'); });

    // Mid-debounce, no write yet.
    act(() => { vi.advanceTimersByTime(200); });
    expect(write).not.toHaveBeenCalled();

    // After the window from the LAST keystroke, exactly one write.
    act(() => { vi.advanceTimersByTime(60); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith('app');
    vi.useRealTimers();
  });

  it('clearing the field writes null instead of empty string', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { result } = renderHook(({ url }) => useDebouncedUrlParam(url, write, 250), {
      initialProps: { url: 'apple' },
    });

    act(() => { result.current[1](''); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });

  it('back/forward URL change adopts the new urlValue into local', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { result, rerender } = renderHook(
      ({ url }) => useDebouncedUrlParam(url, write, 250),
      { initialProps: { url: 'apple' } }
    );

    // Simulate the user clicking back: the URL flips to '' externally.
    rerender({ url: '' });
    expect(result.current[0]).toBe('');

    // No spurious write should fire from the adoption.
    act(() => { vi.advanceTimersByTime(500); });
    expect(write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('REGRESSION: a keystroke arriving during the post-write race window is preserved', () => {
    // The pre-fix code would, on the urlValue prop catching up, force
    // local back to the just-written URL value — overwriting whatever
    // the user had typed in the meantime.
    vi.useFakeTimers();
    const write = vi.fn();
    const { result, rerender } = renderHook(
      ({ url }) => useDebouncedUrlParam(url, write, 250),
      { initialProps: { url: '' } }
    );

    // Step 1: type 'apple', let the debounce fire.
    act(() => { result.current[1]('apple'); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(write).toHaveBeenCalledWith('apple');

    // Step 2: BEFORE the parent re-renders with the new urlValue, the
    // user types one more character. Local advances to 'apples'.
    act(() => { result.current[1]('apples'); });
    expect(result.current[0]).toBe('apples');

    // Step 3: NOW the urlValue prop catches up to what we wrote.
    // The buggy version would yank local back to 'apple' here.
    rerender({ url: 'apple' });
    expect(result.current[0]).toBe('apples'); // <- the regression assertion

    // Step 4: the new local eventually flushes to URL.
    act(() => { vi.advanceTimersByTime(300); });
    expect(write).toHaveBeenLastCalledWith('apples');
    vi.useRealTimers();
  });

  it('write callback identity changes between renders do not reset the timer', () => {
    // Pinning via writeRef means a parent re-render that hands us a new
    // write function must still see the same pending debounce fire on time.
    vi.useFakeTimers();
    const write1 = vi.fn();
    const write2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ writer }) => useDebouncedUrlParam('', writer, 250),
      { initialProps: { writer: write1 } }
    );

    act(() => { result.current[1]('a'); });
    act(() => { vi.advanceTimersByTime(100); });

    // Parent re-renders mid-debounce with a new writer identity.
    rerender({ writer: write2 });

    act(() => { vi.advanceTimersByTime(200); });
    // The latest writer should be the one that got called.
    expect(write1).not.toHaveBeenCalled();
    expect(write2).toHaveBeenCalledTimes(1);
    expect(write2).toHaveBeenLastCalledWith('a');
    vi.useRealTimers();
  });

  it('rapid full-deletion stops at the trailing empty value (one write of null)', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { result } = renderHook(({ url }) => useDebouncedUrlParam(url, write, 250), {
      initialProps: { url: 'apple' },
    });

    act(() => { result.current[1]('appl'); });
    act(() => { result.current[1]('app'); });
    act(() => { result.current[1]('ap'); });
    act(() => { result.current[1]('a'); });
    act(() => { result.current[1](''); });

    act(() => { vi.advanceTimersByTime(300); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });
});
