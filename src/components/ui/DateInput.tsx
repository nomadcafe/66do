'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // 初始化日期值
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const newYear = date.getFullYear().toString();
        const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
        const newDay = date.getDate().toString().padStart(2, '0');
        
        // 只有当值真正不同时才更新，避免循环
        if (year !== newYear || month !== newMonth || day !== newDay) {
          setYear(newYear);
          setMonth(newMonth);
          setDay(newDay);
        }
      }
    } else {
      if (year !== '' || month !== '' || day !== '') {
        setYear('');
        setMonth('');
        setDay('');
      }
    }
  }, [value, year, month, day]);

  // 更新父组件的值
  useEffect(() => {
    if (year && month && day) {
      const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const date = new Date(dateString);
      if (!isNaN(date.getTime()) && dateString !== value) {
        onChange(dateString);
      }
    } else if (!year && !month && !day && value !== '') {
      onChange('');
    }
  }, [year, month, day, onChange, value]);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 4) {
      setYear(val);
      if (val.length === 4) {
        monthRef.current?.focus();
      }
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 2) {
      setMonth(val);
      if (val.length === 2) {
        dayRef.current?.focus();
      }
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 2) {
      setDay(val);
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
