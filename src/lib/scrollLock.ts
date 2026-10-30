/**
 * 锁 <body> 滚动，带引用计数。
 *
 * 以前每个弹窗各自"记下当前 overflow → 设 hidden → 关闭时还原"。只要有两处同时
 * 锁（同一个弹窗里手写一遍又调了 useModalA11y，或者弹窗上再叠一个确认框），
 * 后锁的那个记下的"原值"就是 hidden；清理顺序一错，最后还原回去的就是 hidden，
 * 页面从此滚不动，只能刷新。改成计数：第一把锁记下原值，最后一把锁释放时才还原。
 */
let count = 0;
let saved = '';

export function lockBodyScroll(): () => void {
  if (count === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count--;
    if (count === 0) document.body.style.overflow = saved;
  };
}
