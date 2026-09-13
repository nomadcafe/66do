/**
 * TransactionForm 的冒烟用例：填一笔分期出售并提交，守住三件事
 * —— 金额的小数不会被输入框吞掉、首期付款日走的是 YYYY-MM-DD 分段控件、
 * 「保存并继续添加」不会把弹窗关掉。
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import TransactionForm from './TransactionForm';
import { DomainWithTags } from '../../types/dashboard';

const domain = {
  id: 'd1',
  domain_name: 'example.com',
  status: 'active',
  purchase_date: '2024-01-01',
  purchase_cost: 10,
  renewal_cost: 10,
  renewal_cycle: 1,
  currency: 'USD',
  tags: [],
} as unknown as DomainWithTags;

function setup(onSave = vi.fn()) {
  render(
    <I18nProvider>
      <TransactionForm
        domains={[domain]}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
      />
    </I18nProvider>
  );
  return onSave;
}

/** 表单字段都带稳定 id，按 id 取比按 label 取稳 —— label 文案里 "Amount" 出现好几次 */
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;

function pickDomain() {
  fireEvent.focus(screen.getByPlaceholderText(/search/i));
  fireEvent.click(screen.getByRole('option', { name: /example\.com/ }));
}

function fillDate(prefix: RegExp, y: string, m: string, d: string) {
  const seg = (suffix: string) =>
    screen.getByLabelText(new RegExp(`${prefix.source}.*\\(${suffix}\\)`, 'i')) as HTMLInputElement;
  fireEvent.change(seg('YYYY'), { target: { value: y } });
  fireEvent.change(seg('MM'), { target: { value: m } });
  fireEvent.change(seg('DD'), { target: { value: d } });
}

describe('TransactionForm', () => {
  it('keeps decimals in the amount field and submits them intact', async () => {
    const onSave = setup();
    pickDomain();
    fillDate(/date/i, '2026', '03', '10');

    const amount = byId('transaction-form-amount');
    for (const ch of '10.05') {
      fireEvent.change(amount, { target: { value: amount.value + ch } });
    }
    expect(amount.value).toBe('10.05');

    fireEvent.submit(amount.closest('form')!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      amount: 10.05,
      date: '2026-03-10',
      domain_id: 'd1',
    });
  });

  it('asks the parent to keep the modal open for "save and add another"', async () => {
    const onSave = setup();
    pickDomain();
    fillDate(/date/i, '2026', '03', '10');
    fireEvent.change(byId('transaction-form-amount'), { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: /add another/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1]).toEqual({ keepFormOpen: true });
  });

  it('refuses to submit without a date instead of sending an empty one', async () => {
    const onSave = setup();
    pickDomain();
    fireEvent.change(byId('transaction-form-amount'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /add another/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('starts blank when reopened for a new transaction', () => {
    // 组件一直挂在树上，只靠 isOpen 显隐。重置 effect 以前只依赖 transaction，
    // 而「新增」两次之间 transaction 一直是 undefined —— 依赖没变，effect 不跑，
    // 第二次打开会带着上一笔的金额和日期开场。
    const onClose = vi.fn();
    const props = {
      domains: [domain],
      onClose,
      onSave: vi.fn(),
    };
    const { rerender } = render(
      <I18nProvider>
        <TransactionForm {...props} isOpen />
      </I18nProvider>
    );
    fireEvent.change(byId('transaction-form-amount'), { target: { value: '999' } });
    fillDate(/date/i, '2026', '03', '10');

    rerender(
      <I18nProvider>
        <TransactionForm {...props} isOpen={false} />
      </I18nProvider>
    );
    rerender(
      <I18nProvider>
        <TransactionForm {...props} isOpen />
      </I18nProvider>
    );

    expect(byId('transaction-form-amount').value).toBe('');
    expect(
      (screen.getByLabelText(/^date.*\(YYYY\)/i) as HTMLInputElement).value
    ).toBe('');
  });

  it('renders the installment first-payment date as YYYY-MM-DD segments', () => {
    setup();
    pickDomain();
    fireEvent.change(byId('transaction-form-type'), { target: { value: 'sell' } });
    fireEvent.change(screen.getByDisplayValue(/lump sum/i), { target: { value: 'installment' } });
    const yearSeg = screen.getByLabelText(/first payment date.*\(YYYY\)/i) as HTMLInputElement;
    expect(yearSeg.getAttribute('type')).toBe('text');
    fireEvent.change(yearSeg, { target: { value: '2026' } });
    expect(document.activeElement).toBe(
      screen.getByLabelText(/first payment date.*\(MM\)/i)
    );
  });
});

describe('TransactionForm — 分期字段', () => {
  function openInstallment() {
    const onSave = setup();
    pickDomain();
    fillDate(/date/i, '2026', '03', '10');
    fireEvent.change(byId('transaction-form-type'), { target: { value: 'sell' } });
    fireEvent.change(byId('transaction-form-amount'), { target: { value: '12000' } });
    fireEvent.change(screen.getByDisplayValue(/lump sum/i), { target: { value: 'installment' } });
    fireEvent.change(byId('transaction-form-installment-period'), { target: { value: '12' } });
    return onSave;
  }

  it('shows the per-period amount as a derived, read-only value', () => {
    openInstallment();
    const perPeriod = byId('transaction-form-installment-amount');
    expect(perPeriod.readOnly).toBe(true);
    expect(perPeriod.value).toBe('1000');
    // 打进去也不该留下——effect 会立刻按公式覆盖
    fireEvent.change(perPeriod, { target: { value: '999' } });
    expect(byId('transaction-form-installment-amount').value).toBe('1000');
  });

  it('saves the installment total instead of a hardcoded 0', async () => {
    const onSave = openInstallment();
    fireEvent.change(byId('transaction-form-downpayment'), { target: { value: '2000' } });
    fireEvent.submit(byId('transaction-form-amount').closest('form')!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0];
    // 2000 首付 + 每期 (12000-2000)/12 × 12 期 = 12000
    expect(saved.total_installment_amount).toBeCloseTo(12000, 6);
  });

  it('leaves the installment total unset for a lump-sum transaction', async () => {
    const onSave = setup();
    pickDomain();
    fillDate(/date/i, '2026', '03', '10');
    fireEvent.change(byId('transaction-form-amount'), { target: { value: '500' } });
    fireEvent.submit(byId('transaction-form-amount').closest('form')!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].total_installment_amount).toBeUndefined();
  });
});
