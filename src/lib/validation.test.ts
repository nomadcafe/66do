import { describe, it, expect } from 'vitest';
import {
  validateDomain,
  validateTransaction,
  validateInstallmentReceipt,
  translateValidationMessages,
} from './validation';
import zh from '../i18n/translations/zh';
import en from '../i18n/translations/en';

type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>(
    (cur, part) => (cur && typeof cur === 'object' ? (cur as Dict)[part] : undefined),
    dict
  );
  return typeof value === 'string' ? value : undefined;
}

/** 模拟 useI18n 的 t：查得到返回译文，查不到原样返回 key */
const makeT = (dict: Dict) => (key: string) => lookup(dict, key) ?? key;

function flatKeys(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? flatKeys(v as Dict, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe('翻译词条完整性', () => {
  it('zh / en 的 validation 键集合一致', () => {
    const zhKeys = flatKeys((zh as Dict).validation as Dict).sort();
    const enKeys = flatKeys((en as Dict).validation as Dict).sort();
    expect(zhKeys).toEqual(enKeys);
  });
});

describe('validateDomain 的报错全部是可翻译的 i18n 键', () => {
  // 每条覆盖一类校验分支，确保发出的 key 在两种语言里都能查到
  const badDomains: Array<[string, unknown]> = [
    ['非对象', 'not-an-object'],
    ['缺域名名称', { status: 'active' }],
    ['域名格式非法', { domain_name: 'no-tld', status: 'active' }],
    ['名称为空', { domain_name: '   ', status: 'active' }],
    ['状态非法', { domain_name: 'a.com', status: 'bogus' }],
    ['缺状态', { domain_name: 'a.com' }],
    ['注册商类型错', { domain_name: 'a.com', status: 'active', registrar: 123 }],
    ['注册商过长', { domain_name: 'a.com', status: 'active', registrar: 'x'.repeat(101) }],
    ['购买日期非法', { domain_name: 'a.com', status: 'active', purchase_date: 'garbage' }],
    ['购买日期太远', { domain_name: 'a.com', status: 'active', purchase_date: '2999-01-01' }],
    ['购买成本非数字', { domain_name: 'a.com', status: 'active', purchase_cost: 'abc' }],
    ['购买成本为负', { domain_name: 'a.com', status: 'active', purchase_cost: -1 }],
    ['购买成本超上限', { domain_name: 'a.com', status: 'active', purchase_cost: 1e9 }],
    ['续费成本非数字', { domain_name: 'a.com', status: 'active', renewal_cost: 'abc' }],
    ['续费成本为负', { domain_name: 'a.com', status: 'active', renewal_cost: -1 }],
    ['续费成本超上限', { domain_name: 'a.com', status: 'active', renewal_cost: 1e9 }],
    ['续费周期非整数', { domain_name: 'a.com', status: 'active', renewal_cycle: 1.5 }],
    ['续费周期为0', { domain_name: 'a.com', status: 'active', renewal_cycle: 0 }],
    ['续费周期超上限', { domain_name: 'a.com', status: 'active', renewal_cycle: 99 }],
    ['续费次数非整数', { domain_name: 'a.com', status: 'active', renewal_count: 1.5 }],
    ['续费次数为负', { domain_name: 'a.com', status: 'active', renewal_count: -1 }],
    ['续费次数超上限', { domain_name: 'a.com', status: 'active', renewal_count: 999 }],
    ['到期日非法', { domain_name: 'a.com', status: 'active', expiry_date: 'garbage' }],
    ['到期日太远', { domain_name: 'a.com', status: 'active', expiry_date: '9999-01-01' }],
    ['下次续费日非法', { domain_name: 'a.com', status: 'active', next_renewal_date: 'garbage' }],
    ['下次续费日太远', { domain_name: 'a.com', status: 'active', next_renewal_date: '9999-01-01' }],
    ['注册日非法', { domain_name: 'a.com', status: 'active', registration_date: 'garbage' }],
    ['注册日在未来', { domain_name: 'a.com', status: 'active', registration_date: '2999-01-01' }],
    ['基线日非法', { domain_name: 'a.com', status: 'active', baseline_renewal_as_of: 'garbage' }],
    ['估值非数字', { domain_name: 'a.com', status: 'active', estimated_value: 'abc' }],
    ['估值为负', { domain_name: 'a.com', status: 'active', estimated_value: -1 }],
    ['估值超上限', { domain_name: 'a.com', status: 'active', estimated_value: 1e10 }],
    [
      '到期早于购买',
      { domain_name: 'a.com', status: 'active', purchase_date: '2024-01-01', expiry_date: '2023-01-01' },
    ],
    [
      '出售早于购买',
      { domain_name: 'a.com', status: 'active', purchase_date: '2024-01-01', sale_date: '2023-01-01' },
    ],
    ['标签过多', { domain_name: 'a.com', status: 'active', tags: Array(21).fill('t') }],
    ['标签非字符串', { domain_name: 'a.com', status: 'active', tags: ['ok', 42] }],
    ['标签过长', { domain_name: 'a.com', status: 'active', tags: ['x'.repeat(51)] }],
  ];

  it.each(badDomains)('%s：每条报错都能翻成中英文', (_label, input) => {
    const { valid, errors } = validateDomain(input);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);

    for (const err of errors) {
      expect(err).toMatch(/^validation\.domain\./);
    }

    for (const dict of [zh, en] as Dict[]) {
      const translated = translateValidationMessages(errors, makeT(dict));
      for (const msg of translated) {
        // 翻不出来时 translateValidationMessages 会原样返回 key
        expect(msg).not.toMatch(/^validation\./);
        expect(msg).not.toContain('{0}');
      }
    }
  });

  it('合法域名不报错', () => {
    expect(validateDomain({ domain_name: 'example.com', status: 'active' }).valid).toBe(true);
  });

  it('过去的下次续费日不报错——过期未续的域名就是这种状态', () => {
    const result = validateDomain({
      domain_name: 'example.com',
      status: 'expired',
      next_renewal_date: '2020-01-01',
    });
    expect(result.errors).toEqual([]);
  });

  it('正常的未来到期日不报错——ICANN 单次注册上限就是 10 年', () => {
    const inTwoYears = new Date();
    inTwoYears.setFullYear(inTwoYears.getFullYear() + 2);
    const result = validateDomain({
      domain_name: 'example.com',
      status: 'active',
      expiry_date: inTwoYears.toISOString().slice(0, 10),
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('validateTransaction 的报错同样是可翻译的 i18n 键', () => {
  it('缺字段时报错都能翻成中英文', () => {
    const { valid, errors } = validateTransaction({});
    expect(valid).toBe(false);

    for (const dict of [zh, en] as Dict[]) {
      for (const msg of translateValidationMessages(errors, makeT(dict))) {
        expect(msg).not.toMatch(/^validation\./);
      }
    }
  });
});

describe('validateInstallmentReceipt', () => {
  const valid = {
    transaction_id: 'tx-1',
    received_date: '2025-06-01',
    amount: 100,
    period_no: 3,
    notes: 'first payment',
  };

  it('合法收款不报错', () => {
    expect(validateInstallmentReceipt(valid).errors).toEqual([]);
  });

  it('负数金额合法——表示退款 / 中断分期', () => {
    expect(validateInstallmentReceipt({ ...valid, amount: -50 }).valid).toBe(true);
  });

  it('未来到账日合法——UI 支持提前登记下一期', () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    expect(
      validateInstallmentReceipt({ ...valid, received_date: nextMonth.toISOString().slice(0, 10) })
        .valid
    ).toBe(true);
  });

  it('period_no 可以省略', () => {
    expect(validateInstallmentReceipt({ ...valid, period_no: null }).valid).toBe(true);
  });

  const badReceipts: Array<[string, unknown]> = [
    ['非对象', 'nope'],
    ['缺交易 id', { ...valid, transaction_id: '' }],
    ['缺到账日', { ...valid, received_date: '' }],
    ['到账日非法', { ...valid, received_date: 'garbage' }],
    ['到账日太远', { ...valid, received_date: '9999-01-01' }],
    ['缺金额', { ...valid, amount: null }],
    ['金额非数字', { ...valid, amount: 'abc' }],
    ['金额为 0', { ...valid, amount: 0 }],
    ['金额超上限', { ...valid, amount: 2e8 }],
    ['负数金额超上限', { ...valid, amount: -2e8 }],
    ['期数非整数', { ...valid, period_no: 1.5 }],
    ['期数为 0', { ...valid, period_no: 0 }],
    ['期数超上限', { ...valid, period_no: 9999 }],
    ['备注非字符串', { ...valid, notes: 42 }],
    ['备注过长', { ...valid, notes: 'x'.repeat(1001) }],
  ];

  it.each(badReceipts)('%s：报错是可翻译的 i18n 键', (_label, input) => {
    const { valid: isValid, errors } = validateInstallmentReceipt(input);
    expect(isValid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);

    for (const err of errors) {
      expect(err).toMatch(/^validation\.receipt\./);
    }

    for (const dict of [zh, en] as Dict[]) {
      for (const msg of translateValidationMessages(errors, makeT(dict))) {
        expect(msg).not.toMatch(/^validation\./);
      }
    }
  });
});

describe('translateValidationMessages', () => {
  const t = makeT(en as Dict);

  it('把位置参数填进 {0}', () => {
    expect(translateValidationMessages(['validation.domain.tagTooLong|3'], t)).toEqual([
      'Tag 3 cannot exceed 50 characters',
    ]);
  });

  it('保留批量创建的 #N 前缀', () => {
    expect(translateValidationMessages(['#2: validation.domain.nameRequired'], t)).toEqual([
      '#2: Domain name is required',
    ]);
  });

  it('#N 前缀与位置参数可以并存', () => {
    expect(translateValidationMessages(['#2: validation.domain.tagTooLong|1'], t)).toEqual([
      '#2: Tag 1 cannot exceed 50 characters',
    ]);
  });

  it('非 i18n 键原样返回', () => {
    expect(translateValidationMessages(['Something broke'], t)).toEqual(['Something broke']);
  });

  it('查不到的键原样返回，不吐出半成品文案', () => {
    expect(translateValidationMessages(['validation.domain.nopeNotAKey'], t)).toEqual([
      'validation.domain.nopeNotAKey',
    ]);
  });
});
