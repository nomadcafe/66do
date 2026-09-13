'use client';

import { useEffect, RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(panel: HTMLElement): HTMLElement[] {
  // 刻意不按 offsetParent / getClientRects 过滤"看不见的"元素：这几个弹窗里
  // 的条件区块（分期配置、展开的历史）走的是条件渲染，藏起来时根本不在 DOM 里，
  // 用不着布局信息；而布局信息在 jsdom 里一律是空的，依赖它会让这段逻辑在
  // 测试环境和浏览器里表现不一致。真正需要挡的是 hidden / aria-hidden。
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * 弹窗的键盘可达性：焦点陷阱 + 打开时把焦点收进来 + 关闭时还回去 + 锁背景滚动。
 *
 * DeleteConfirmDialog 早就手写了这一整套（它只有两个按钮，写死在两者之间来回）。
 * 其它几个弹窗没有，于是在表单里按 Tab 会一路走到弹窗背后的页面上 —— 看不见
 * 焦点在哪，继续敲键盘改的是背后那张表。这里把它抽成通用版：在面板范围内找
 * 可聚焦元素，首尾相接。
 *
 * 打开时默认把焦点放到面板本身而不是第一个输入框：面板拿到焦点后按 Tab 就
 * 进第一格，而直接 focus 输入框会在手机上弹出键盘、把半屏内容顶掉。要指定
 * 落点的弹窗，在目标元素上加 data-autofocus。
 */
export function useModalA11y(
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  { lockScroll = true }: { lockScroll?: boolean } = {}
) {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 面板本身要能接焦点，才能当"还没进任何一格"的起点
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
    // effect 跑的时候节点已经挂上了，同步 focus 就够——包一层 setTimeout 只会
    // 让"打开后第一个按键"和焦点落位之间多一个没人管的窗口。
    (preferred ?? panel).focus();

    const prevOverflow = lockScroll ? document.body.style.overflow : null;
    if (lockScroll) document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusableWithin(panel);
      if (items.length === 0) {
        // 面板里没有可聚焦元素时也不能让 Tab 跑出去
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // 焦点还在面板本身（刚打开）或已经漏到外面：拉回首/尾
      if (!active || active === panel || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (lockScroll && prevOverflow !== null) document.body.style.overflow = prevOverflow;
      // 关闭后焦点回到打开它的那个按钮，而不是掉回 <body>
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef, lockScroll]);
}
