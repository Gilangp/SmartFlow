// components/CalendarRangePicker.tsx
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, X } from 'lucide-react';

interface CalendarRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onRangeSelect: (start: string, end: string) => void;
}

export default function CalendarRangePicker({
  startDate,
  endDate,
  onRangeSelect,
}: CalendarRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFocus, setActiveFocus] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync temp state with props when prop changes
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar view state (year and month)
  const initialDate = tempStart ? new Date(tempStart) : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Compute days for current month view
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // Monday as 0: (Sunday=0 -> 6, Monday=1 -> 0, etc.)
    const offset = (firstDayIndex + 6) % 7;

    const days: ({ type: 'empty' } | { type: 'day'; day: number; dateStr: string })[] = [];

    for (let i = 0; i < offset; i++) {
      days.push({ type: 'empty' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      days.push({ type: 'day', day, dateStr });
    }

    return days;
  }, [currentYear, currentMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(currentYear, currentMonth, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [currentYear, currentMonth]);

  // Click handler with explicit field focus (start vs end)
  const handleDayClick = (dateStr: string) => {
    if (activeFocus === 'start') {
      setTempStart(dateStr);
      if (tempEnd && dateStr > tempEnd) {
        setTempEnd('');
      }
      setActiveFocus('end');
    } else {
      // Focus is 'end'
      if (tempStart && dateStr < tempStart) {
        setTempStart(dateStr);
        setTempEnd('');
        setActiveFocus('end');
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const handleApply = () => {
    onRangeSelect(tempStart, tempEnd);
    setIsOpen(false);
  };

  const formatDisplay = (dStr: string) => {
    if (!dStr) return '--/--/----';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const openForStart = () => {
    setActiveFocus('start');
    setIsOpen(true);
  };

  const openForEnd = () => {
    setActiveFocus('end');
    setIsOpen(true);
  };

  // Render Popover Dropdown Card
  const renderPopoverContent = (alignClass: string) => (
    <div className={`absolute z-50 top-full mt-2.5 w-[320px] sm:w-[340px] ${alignClass} bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200`}>
      {/* Popover Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-gray-900 dark:text-white capitalize">
            {monthLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((dayName) => (
          <div key={dayName} className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 py-1">
            {dayName}
          </div>
        ))}
      </div>

      {/* Days Grid with Highlighted Range */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0">
        {calendarDays.map((item, index) => {
          if (item.type === 'empty') {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const { day, dateStr } = item;
          const isStart = tempStart === dateStr;
          const isEnd = tempEnd === dateStr;
          const isSingleDay = isStart && isEnd;

          const effectiveEnd = tempEnd || (tempStart && hoverDate && hoverDate >= tempStart ? hoverDate : '');
          const inRange = Boolean(
            tempStart &&
              effectiveEnd &&
              dateStr > tempStart &&
              dateStr < effectiveEnd
          );

          let cellStyle = 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md';
          let bgContainerStyle = '';

          if (isSingleDay) {
            cellStyle = 'bg-indigo-600 text-white font-bold rounded-md shadow-sm';
          } else if (isStart) {
            cellStyle = 'bg-indigo-600 text-white font-bold rounded-l-md rounded-r-none shadow-sm';
            if (effectiveEnd) bgContainerStyle = 'bg-indigo-100 dark:bg-indigo-950/80 rounded-l-md';
          } else if (isEnd) {
            cellStyle = 'bg-indigo-600 text-white font-bold rounded-r-md rounded-l-none shadow-sm';
            if (tempStart) bgContainerStyle = 'bg-indigo-100 dark:bg-indigo-950/80 rounded-r-md';
          } else if (inRange) {
            cellStyle = 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-100 font-semibold rounded-none';
            bgContainerStyle = 'bg-indigo-100 dark:bg-indigo-950/80';
          }

          return (
            <div key={dateStr} className={`relative flex items-center justify-center ${bgContainerStyle}`}>
              <button
                type="button"
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => setHoverDate(dateStr)}
                className={`w-full h-8 flex items-center justify-center text-xs transition-all ${cellStyle}`}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
          {activeFocus === 'start' ? 'Pilih tanggal mulai' : 'Pilih tanggal akhir'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTempStart('');
              setTempEnd('');
              setActiveFocus('start');
              onRangeSelect('', '');
            }}
            className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!tempStart}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50/80 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60" ref={popoverRef}>
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Tanggal Mulai Box Wrapper */}
        <div className="relative flex-1 min-w-0">
          <div
            onClick={openForStart}
            className="cursor-pointer group"
          >
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition cursor-pointer">
              Tanggal Mulai
            </label>
            <div className={`w-full bg-white dark:bg-gray-900 border text-gray-900 dark:text-white text-xs font-semibold rounded-lg px-3 py-2 flex items-center justify-between shadow-sm transition ${
              isOpen && activeFocus === 'start' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-700 group-hover:border-indigo-500'
            }`}>
              <span>{formatDisplay(startDate)}</span>
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition" />
            </div>
          </div>

          {/* Anchor Popover specifically to Tanggal Mulai box */}
          {isOpen && activeFocus === 'start' && renderPopoverContent('left-0')}
        </div>

        {/* Separator s/d */}
        <div className="flex flex-col items-center justify-center pt-5">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 px-1">s/d</span>
        </div>

        {/* Tanggal Akhir Box Wrapper */}
        <div className="relative flex-1 min-w-0">
          <div
            onClick={openForEnd}
            className="cursor-pointer group"
          >
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition cursor-pointer">
              Tanggal Akhir
            </label>
            <div className={`w-full bg-white dark:bg-gray-900 border text-gray-900 dark:text-white text-xs font-semibold rounded-lg px-3 py-2 flex items-center justify-between shadow-sm transition ${
              isOpen && activeFocus === 'end' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-700 group-hover:border-indigo-500'
            }`}>
              <span>{formatDisplay(endDate)}</span>
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition" />
            </div>
          </div>

          {/* Anchor Popover specifically to Tanggal Akhir box */}
          {isOpen && activeFocus === 'end' && renderPopoverContent('right-0')}
        </div>
      </div>
    </div>
  );
}
