import { describe, it, expect } from 'vitest';
import { getSafeRedirect } from './safeRedirect';

// 用 fromCharCode 构造，避免源文件里出现看不见的控制字符
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);

describe('getSafeRedirect', () => {
  it('放行普通的同源路径', () => {
    expect(getSafeRedirect('/dashboard')).toBe('/dashboard');
    expect(getSafeRedirect('/dashboard?ins=renewals')).toBe('/dashboard?ins=renewals');
    expect(getSafeRedirect('/dashboard#anchor')).toBe('/dashboard#anchor');
    expect(getSafeRedirect('/a/b/c')).toBe('/a/b/c');
  });

  it('缺省 / 非法输入回落到 /dashboard', () => {
    expect(getSafeRedirect(null)).toBe('/dashboard');
    expect(getSafeRedirect(undefined)).toBe('/dashboard');
    expect(getSafeRedirect('')).toBe('/dashboard');
    expect(getSafeRedirect('dashboard')).toBe('/dashboard');
  });

  it('挡住绝对 URL 和协议相对 URL', () => {
    expect(getSafeRedirect('https://evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('//evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('javascript:alert(1)')).toBe('/dashboard');
  });

  it('挡住反斜杠变体 —— login 那份拷贝漏的就是这一档', () => {
    expect(getSafeRedirect('/\\evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('/\\\\evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('\\\\evil.com')).toBe('/dashboard');
  });

  it('挡住夹在中间的控制字符 —— 浏览器会把它删掉再解析', () => {
    // "/<TAB>/evil.com" 进地址栏就是 "//evil.com"；制表符在中间，trim() 去不掉
    expect(getSafeRedirect('/' + TAB + '/evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('/' + LF + '/evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('/' + CR + '/evil.com')).toBe('/dashboard');
    expect(getSafeRedirect('/' + NUL + '/evil.com')).toBe('/dashboard');
  });

  it('前后空白照常容忍', () => {
    expect(getSafeRedirect('  /dashboard  ')).toBe('/dashboard');
  });
});
