import React from 'react';
import DatePicker from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  required?: boolean;
  placeholder?: string;
}

export function DateTimePicker({ label, value, onChange, minDate, required, placeholder }: Props) {
  return (
    <div className="dtp-wrapper">
      <label className="block text-xs text-guin-muted mb-1">{label}{required && ' *'}</label>
      <div className="relative">
        <DatePicker
          selected={value}
          onChange={onChange}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={15}
          dateFormat="dd/MM/yyyy HH:mm"
          locale={fr}
          minDate={minDate}
          placeholderText={placeholder ?? 'Sélectionner…'}
          className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-guin-border focus:outline-none focus:border-guin-gold cursor-pointer"
          calendarClassName="dtp-calendar"
          popperClassName="dtp-popper"
          popperPlacement="bottom-start"
          showPopperArrow={false}
          isClearable
          clearButtonClassName="dtp-clear"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-guin-muted">
          <Calendar size={13} />
          <Clock size={13} />
        </div>
      </div>
    </div>
  );
}
