'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  label?: string;
  icon?: React.ReactNode;
}

export default function DateInput({ 
  value, 
  onChange, 
  required = false,
  className = "",
  label,
  icon
}: DateInputProps) {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  
  // 从 value 解析出年月日
  const parsedDate = useMemo(() => {
    if (value) {
      // 如果 value 包含时间信息，只取日期部分
      const dateString = value.includes('T') ? value.split('T')[0] : value;
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return {
          year: date.getFullYear().toString(),
          month: (date.getMonth() + 1).toString().padStart(2, '0'),
          day: date.getDate().toString().padStart(2, '0')
        };
      }
    }
    return { year: '', month: '', day: '' };
  }, [value]);

  const [year, setYear] = useState(parsedDate.year);
  const [month, setMonth] = useState(parsedDate.month);
  const [day, setDay] = useState(parsedDate.day);

  // 同步外部 value 到内部状态
  useEffect(() => {
    setYear(parsedDate.year);
    setMonth(parsedDate.month);
    setDay(parsedDate.day);
  }, [parsedDate.year, parsedDate.month, parsedDate.day]);

  const updateParentValue = (newYear: string, newMonth: string, newDay: string) => {
    if (newYear && newMonth && newDay) {
      const dateString = `${newYear}-${newMonth.padStart(2, '0')}-${newDay.padStart(2, '0')}`;
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        onChange(dateString);
      }
    } else if (!newYear && !newMonth && !newDay) {
      onChange('');
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 4) {
      setYear(val);
      if (val.length === 4) {
        monthRef.current?.focus();
      }
      updateParentValue(val, month, day);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 2) {
      setMonth(val);
      if (val.length === 2) {
        dayRef.current?.focus();
      }
      updateParentValue(year, val, day);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 2) {
      setDay(val);
      updateParentValue(year, month, val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextRef: React.RefObject<HTMLInputElement | null>) => {
    if (e.key === 'Backspace' && e.currentTarget.value === '') {
      // 如果当前字段为空且按下退格键，回到上一个字段
      if (nextRef === monthRef) {
        yearRef.current?.focus();
      } else if (nextRef === dayRef) {
        monthRef.current?.focus();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      nextRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      // 左箭头键回到上一个字段
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
          value={year}
          onChange={handleYearChange}
          onKeyDown={(e) => handleKeyDown(e, monthRef)}
          placeholder="YYYY"
          maxLength={4}
          className="w-16 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
        <span className="text-gray-500">-</span>
        <input
          ref={monthRef}
          type="text"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, dayRef)}
          placeholder="MM"
          maxLength={2}
          className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
        <span className="text-gray-500">-</span>
        <input
          ref={dayRef}
          type="text"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, dayRef)}
          placeholder="DD"
          maxLength={2}
          className="w-12 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
      </div>
    </div>
  );
}
