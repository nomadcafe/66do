/** 焦点陷阱 hook 的行为守卫 */
import React, { useRef, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useModalA11y } from './useModalA11y';

function Harness({ open }: { open: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, open);
  return (
    <>
      <button>behind</button>
      {open && (
        <div ref={panelRef}>
          <button>first</button>
          <input aria-label="middle" />
          <button>last</button>
        </div>
      )}
    </>
  );
}

function App() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <Harness open={open} />
      {open && <button onClick={() => setOpen(false)}>close-outer</button>}
    </>
  );
}

const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('useModalA11y', () => {
  it('pulls focus into the panel when it opens', () => {
    act(() => {
      render(<Harness open />);
    });
    expect(document.activeElement?.tagName).toBe('DIV');
  });

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Harness open />);
    btn('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(btn('first'));
  });

  it('wraps Shift+Tab from the first back to the last', () => {
    render(<Harness open />);
    btn('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btn('last'));
  });

  it('drags focus back in if it has leaked outside the panel', () => {
    render(<Harness open />);
    btn('behind').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(btn('first'));
  });

  it('leaves keys other than Tab alone', () => {
    render(<Harness open />);
    const mid = screen.getByLabelText('middle');
    mid.focus();
    fireEvent.keyDown(document, { key: 'a' });
    expect(document.activeElement).toBe(mid);
  });

  it('locks background scroll while open and restores it on close', () => {
    const { rerender } = render(<Harness open={false} />);
    expect(document.body.style.overflow).toBe('');
    rerender(<Harness open />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Harness open={false} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('returns focus to whatever opened it', () => {
    render(<App />);
    const opener = btn('opener');
    opener.focus();
    act(() => {
      fireEvent.click(opener);
    });
    expect(document.activeElement).not.toBe(opener);
    act(() => {
      fireEvent.click(btn('close-outer'));
    });
    expect(document.activeElement).toBe(opener);
  });
});
