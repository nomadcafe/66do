'use client';

import React, { useState } from 'react';

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  /** null = 未填（仅 nullable 字段会用到），number = 明确值 */
  value: number | null;
  onChange: (value: number | null) => void;
  /** 值为 0 时显示成空框 —— 表单里大部分字段把 0 当"没填" */
  blankWhenZero?: boolean;
  /** 清空输入框时回报什么：0（默认）还是 null（"未记录"与"明确是 0"要分开的字段） */
  emptyValue?: 0 | null;
  /** 只收整数（期数、年数） */
  integer?: boolean;
  /** 失焦时把值夹到区间内；输入过程中不夹，否则打 "1" 想打 "10" 会被顶掉 */
  min?: number;
  max?: number;
}

/**
 * 数字输入框。**不是** `type="number"`。
 *
 * 为什么不用原生 number：原生 number 的 `.value` 会对"输入中的中间态"做
 * sanitize —— 打到 "10." 时 `e.target.value` 返回的是空字符串。表单里所有
 * 金额框都是 `value={x === 0 ? '' : x}` + `onChange={parseFloat(e.target.value) || 0}`
 * 的受控写法，于是：
 *   "1" → 1，"10" → 10，"10." → '' → parseFloat('')=NaN → 0 → 框被清空，
 *   再打 "0" → 0 → 框又是空，再打 "5" → 5。
 * 想输入 $10.05，最后存进去的是 $5。费率框更糟，0.15 / 0.075 这种以 0. 开头的
 * 值根本打不进去（第一个字符 "0" 就被渲染成空）。
 *
 * 改法：type="text" + inputMode="decimal" 拿到未经 sanitize 的原始文本，
 * 输入过程中保留一份字符串草稿（draft）供显示，同时把能解析出来的数值往上报；
 * 失焦时丢掉草稿、回到受控数值的规范显示。代价是没有原生上下箭头和
 * min/max 校验 —— 前者在金额表单里没人用，后者用失焦夹取代。
 */
export default function NumberInput({
  value,
  onChange,
  blankWhenZero = false,
  emptyValue = 0,
  integer = false,
  min,
  max,
  onBlur,
  ...rest
}: NumberInputProps) {
  // null = 没在输入中，显示受控值；string = 输入中的原始文本
  const [draft, setDraft] = useState<string | null>(null);

  const display =
    draft !== null
      ? draft
      : value === null || (blankWhenZero && value === 0)
        ? ''
        : String(value);

  const sanitize = (raw: string) => {
    // 允许负号只在开头；小数点只保留第一个；整数模式直接丢掉小数部分
    const negative = !integer && raw.trimStart().startsWith('-');
    const digitsAndDots = raw.replace(integer ? /[^\d]/g : /[^\d.]/g, '');
    const firstDot = digitsAndDots.indexOf('.');
    const cleaned =
      firstDot === -1
        ? digitsAndDots
        : digitsAndDots.slice(0, firstDot + 1) +
          digitsAndDots.slice(firstDot + 1).replace(/\./g, '');
    // 负号在 cleaned 还是空的时候也要留住，否则打退款金额 "-25" 时，
    // 第一下只有 "-" → 草稿被清成空 → 符号丢了，最后录成 +25。
    return (negative ? '-' : '') + cleaned;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitize(e.target.value);
    setDraft(next);
    if (next === '' || next === '-' || next === '.' || next === '-.') {
      onChange(emptyValue);
      return;
    }
    const parsed = integer ? parseInt(next, 10) : parseFloat(next);
    // "10." 解析成 10 但草稿保留小数点，所以下一位数字还能接着打
    onChange(Number.isFinite(parsed) ? parsed : emptyValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setDraft(null);
    if (value !== null) {
      let clamped = value;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      if (clamped !== value) onChange(clamped);
    }
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
