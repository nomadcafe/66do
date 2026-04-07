'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  label?: string;
  icon?: React.ReactNode;
}

/** 从 YYYY-MM-DD 拆成输入框展示用字符串（月日不带无意义的前导 0，避免与输入中的「1」冲突） */
function parseValueToParts(value: string): { year: string; month: string; day: string } {
  if (!value) return { year: '', month: '', day: '' };
  const datePart = value.includes('T') ? value.split('T')[0] : value;
  const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return { year: '', month: '', day: '' };
  return {
    year: m[1],
    month: String(parseInt(m[2], 10)),
    day: String(parseInt(m[3], 10)),
  };
}

export default function DateInput({
  value,
  onChange,
  required = false,
  className = '',
  label,
  icon,
}: DateInputProps) {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const parsedDate = useMemo(() => parseValueToParts(value), [value]);

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    setYear(parsedDate.year);
    setMonth(parsedDate.month);
    setDay(parsedDate.day);
  }, [parsedDate.year, parsedDate.month, parsedDate.day]);

  const tryCommit = useCallback(
    (y: string, mo: string, d: string) => {
      if (!y && !mo && !d) {
        onChange('');
        return;
      }
      if (y.length !== 4 || !mo || !d) return;

      const yNum = parseInt(y, 10);
      const mNum = parseInt(mo, 10);
      const dNum = parseInt(d, 10);
      if (!Number.isFinite(yNum) || !Number.isFinite(mNum) || !Number.isFinite(dNum)) return;
      if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) return;

      const dt = new Date(yNum, mNum - 1, dNum);
      if (dt.getFullYear() !== yNum || dt.getMonth() !== mNum - 1 || dt.getDate() !== dNum) return;

      const iso = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      onChange(iso);
    },
    [onChange]
  );

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(val);
    if (val.length === 4) {
      monthRef.current?.focus();
      tryCommit(val, month, day);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMonth(val);
    if (val.length === 2) {
      dayRef.current?.focus();
      tryCommit(year, val, day);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(val);
    if (val.length === 2) {
      tryCommit(year, month, val);
    }
  };

  const handleBlurCommit = () => {
    tryCommit(year, month, day);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === 'Backspace' && e.currentTarget.value === '') {
      if (nextRef === monthRef) {
        yearRef.current?.focus();
      } else if (nextRef === dayRef) {
        monthRef.current?.focus();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      nextRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      if (nextRef === monthRef) {
        yearRef.current?.focus();
      } else if (nextRef === dayRef) {
        monthRef.current?.focus();
      }
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {icon && <span className="inline-flex items-center mr-1">{icon}</span>}
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex items-center space-x-2">
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          value={year}
          onChange={handleYearChange}
          onBlur={handleBlurCommit}
          onKeyDown={(e) => handleKeyDown(e, monthRef)}
          placeholder="YYYY"
          maxLength={4}
          className="w-16 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
        <span className="text-gray-500">-</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          value={month}
          onChange={handleMonthChange}
          onBlur={handleBlurCommit}
          onKeyDown={(e) => handleKeyDown(e, dayRef)}
          placeholder="MM"
          maxLength={2}
          className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
        <span className="text-gray-500">-</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          value={day}
          onChange={handleDayChange}
          onBlur={handleBlurCommit}
          onKeyDown={(e) => handleKeyDown(e, dayRef)}
          placeholder="DD"
          maxLength={2}
          className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
      </div>
    </div>
  );
}
