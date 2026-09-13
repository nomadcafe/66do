/** RenewalModal 的输入层冒烟：金额小数不被吞、续费日期默认是本地今天 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import { localCalendarDateISO } from '../../lib/localCalendarDate';
import RenewalModal from './RenewalModal';
import { DomainWithTags } from '../../types/dashboard';

const domain = {
  id: 'd1',
  domain_name: 'example.com',
  status: 'active',
  purchase_date: '2024-01-01',
  purchase_cost: 10,
  renewal_cost: 0,
  renewal_cycle: 1,
  currency: 'USD',
  registrar: 'Namecheap',
  tags: [],
} as unknown as DomainWithTags;

function setup() {
  const onRenew = vi.fn().mockResolvedValue(undefined);
  render(
    <I18nProvider>
      <RenewalModal isOpen onClose={vi.fn()} domain={domain} onRenew={onRenew} />
    </I18nProvider>
  );
  return onRenew;
}

describe('RenewalModal', () => {
  it('keeps decimals in the renewal amount', () => {
    setup();
    const amount = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    for (const ch of '11.88') {
      fireEvent.change(amount, { target: { value: amount.value + ch } });
    }
    expect(amount.value).toBe('11.88');
  });

  it('defaults the renewal date to the local calendar day', () => {
    setup();
    const today = localCalendarDateISO();
    const [y, m, d] = today.split('-');
    expect((screen.getByLabelText(/Renewal date \(YYYY\)/) as HTMLInputElement).value).toBe(y);
    expect((screen.getByLabelText(/Renewal date \(MM\)/) as HTMLInputElement).value).toBe(
      String(Number(m))
    );
    expect((screen.getByLabelText(/Renewal date \(DD\)/) as HTMLInputElement).value).toBe(
      String(Number(d))
    );
  });
});
