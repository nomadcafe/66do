/** DateInput 的段间导航与提交守卫 */
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateInput from './DateInput';

function Harness({ initial = '', required = false }: { initial?: string; required?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateInput label="Date" value={value} onChange={setValue} required={required} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const seg = (name: 'YYYY' | 'MM' | 'DD') =>
  screen.getByLabelText(`Date (${name})`) as HTMLInputElement;

describe('DateInput', () => {
  it('jumps from year to month once four digits are in', () => {
    render(<Harness />);
    fireEvent.change(seg('YYYY'), { target: { value: '2026' } });
    expect(document.activeElement).toBe(seg('MM'));
  });

  it('leaves Tab to the browser so it does not skip the month segment', () => {
    render(<Harness />);
    const year = seg('YYYY');
    year.focus();
    // 以前 Tab 和 ArrowRight 共用一个分支，在 keydown 里先把焦点挪走，
    // 浏览器的默认行为再挪一次 —— 从「年」按 Tab 直接落到「日」。
    fireEvent.keyDown(year, { key: 'Tab' });
    expect(document.activeElement).toBe(year);
  });

  it('commits only a complete, real date', () => {
    render(<Harness />);
    fireEvent.change(seg('YYYY'), { target: { value: '2026' } });
    fireEvent.change(seg('MM'), { target: { value: '02' } });
    expect(screen.getByTestId('value').textContent).toBe('');
    fireEvent.change(seg('DD'), { target: { value: '30' } });
    expect(screen.getByTestId('value').textContent).toBe('');
    fireEvent.change(seg('DD'), { target: { value: '28' } });
    expect(screen.getByTestId('value').textContent).toBe('2026-02-28');
  });

  it('marks every segment required so the browser blocks an empty submit', () => {
    render(<Harness required />);
    for (const name of ['YYYY', 'MM', 'DD'] as const) {
      expect(seg(name).required).toBe(true);
    }
  });

  it('renders a single asterisk for a required field', () => {
    render(<Harness required />);
    expect(screen.getByText('Date').textContent).toBe('Date*');
  });
});
