/**
 * NumberInput 的回归守卫。
 *
 * 这些用例全部是在原生 `type="number"` 上会失败的场景：原生 number 的
 * `.value` 对输入中间态做 sanitize，"10." 读回来是空字符串，于是
 * `value={x === 0 ? '' : x}` + `parseFloat(e.target.value) || 0` 的受控写法
 * 会在打小数点的那一刻把框清空，$10.05 最后存成 $5。
 */
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumberInput from './NumberInput';

function Harness({
  initial = 0,
  ...props
}: { initial?: number | null } & Partial<React.ComponentProps<typeof NumberInput>>) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <NumberInput
        aria-label="field"
        value={value}
        onChange={setValue}
        {...props}
      />
      <output data-testid="value">{value === null ? 'null' : String(value)}</output>
    </>
  );
}

/** 模拟逐字符键入：每次把整段文本重新写进去，和受控 input 的实际行为一致 */
function type(el: HTMLInputElement, text: string) {
  for (const ch of text) {
    fireEvent.change(el, { target: { value: el.value + ch } });
  }
}

describe('NumberInput', () => {
  it('keeps the decimal point mid-typing so 10.05 survives', () => {
    render(<Harness blankWhenZero min={0} />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    type(el, '10.05');
    expect(el.value).toBe('10.05');
    expect(screen.getByTestId('value').textContent).toBe('10.05');
  });

  it('accepts rates that start with "0." (0.075)', () => {
    render(<Harness blankWhenZero min={0} max={1} />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    type(el, '0.075');
    expect(el.value).toBe('0.075');
    expect(screen.getByTestId('value').textContent).toBe('0.075');
  });

  it('renders 0 as an empty box when blankWhenZero, and as "0" without it', () => {
    const { unmount } = render(<Harness blankWhenZero />);
    expect((screen.getByLabelText('field') as HTMLInputElement).value).toBe('');
    unmount();
    render(<Harness />);
    expect((screen.getByLabelText('field') as HTMLInputElement).value).toBe('0');
  });

  it('clamps to [min, max] on blur, not while typing', () => {
    render(<Harness initial={0} integer min={1} max={10} blankWhenZero />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    // 输入过程中不夹：想打 "10" 得先经过 "1"
    type(el, '1');
    expect(screen.getByTestId('value').textContent).toBe('1');
    type(el, '0');
    expect(screen.getByTestId('value').textContent).toBe('10');
    // 超出上界的值在失焦时被夹回来
    fireEvent.change(el, { target: { value: '99' } });
    fireEvent.blur(el);
    expect(screen.getByTestId('value').textContent).toBe('10');
  });

  it('rejects non-numeric characters and extra decimal points', () => {
    render(<Harness blankWhenZero />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '1a2.3.4' } });
    expect(el.value).toBe('12.34');
  });

  it('drops the fractional part in integer mode', () => {
    render(<Harness integer blankWhenZero />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    type(el, '1.5');
    expect(el.value).toBe('15');
  });

  it('distinguishes "cleared" from "explicit 0" when emptyValue is null', () => {
    render(<Harness initial={null} emptyValue={null} min={0} />);
    const el = screen.getByLabelText('field') as HTMLInputElement;
    expect(el.value).toBe('');
    expect(screen.getByTestId('value').textContent).toBe('null');
    type(el, '0');
    expect(screen.getByTestId('value').textContent).toBe('0');
    fireEvent.change(el, { target: { value: '' } });
    expect(screen.getByTestId('value').textContent).toBe('null');
  });
});
