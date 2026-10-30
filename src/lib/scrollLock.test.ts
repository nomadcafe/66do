import { describe, it, expect, beforeEach } from 'vitest';
import { lockBodyScroll } from './scrollLock';

describe('lockBodyScroll', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('嵌套锁按任意顺序释放后都还原', () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    a();
    expect(document.body.style.overflow).toBe('hidden');
    b();
    expect(document.body.style.overflow).toBe('');
  });

  it('同一把锁重复释放不会多减计数', () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    a();
    expect(document.body.style.overflow).toBe('hidden');
    b();
    expect(document.body.style.overflow).toBe('');
  });
});
