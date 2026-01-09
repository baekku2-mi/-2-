import React, { useState, useEffect, useRef } from 'react';

interface InputGroupProps {
  label: string;
  subLabel?: string;
  value: number;
  onChange: (val: number) => void;
  unit: string;
  step?: number;
  placeholder?: string;
  useCommas?: boolean;
}

const InputGroup: React.FC<InputGroupProps> = ({
  label,
  subLabel,
  value,
  onChange,
  unit,
  placeholder,
  useCommas = true
}) => {
  // Use local state to manage the input value as a string.
  // This preserves intermediate states like "84." which would otherwise be lost 
  // if we strictly relied on number formatting on every render.
  const format = (num: number) => useCommas ? num.toLocaleString() : num.toString();
  
  const [localValue, setLocalValue] = useState(value === 0 ? '' : format(value));
  
  // Track the last value emitted to the parent to distinguish between
  // updates caused by local typing vs updates from the parent (e.g. reset).
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    // If the prop value differs from what we last sent up, it means the parent 
    // changed it externally (e.g. reset, or calculated from elsewhere), so we sync.
    if (value !== lastEmittedValue.current) {
      setLocalValue(value === 0 ? '' : format(value));
      lastEmittedValue.current = value;
    }
  }, [value, useCommas]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Regex: Remove anything that isn't a digit, dot, or comma
    const cleanInput = inputValue.replace(/[^\d.,]/g, '');

    // Prevent multiple decimal points
    const parts = cleanInput.split('.');
    if (parts.length > 2) return; 

    setLocalValue(cleanInput);

    // Remove commas for parsing
    const numericValue = parseFloat(cleanInput.replace(/,/g, ''));
    const newValue = isNaN(numericValue) ? 0 : numericValue;
    
    lastEmittedValue.current = newValue;
    onChange(newValue);
  };

  const handleBlur = () => {
    // On blur, format the number nicely (e.g. add commas)
    const numericValue = parseFloat(localValue.replace(/,/g, ''));
    if (!isNaN(numericValue) && numericValue !== 0) {
      // Limit to 4 decimal places for display consistency, 
      // but allow decimals to remain if user typed them.
      const formatted = useCommas 
        ? numericValue.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : numericValue.toString();
      setLocalValue(formatted);
    } else if (numericValue === 0) {
      setLocalValue('');
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {subLabel && <p className="text-xs text-slate-500 mb-2">{subLabel}</p>}
      <div className="relative rounded-md shadow-sm">
        <input
          type="text"
          className="block w-full rounded-md border-slate-300 pl-3 pr-12 py-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border text-right"
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          inputMode="decimal"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-slate-500 sm:text-sm">{unit}</span>
        </div>
      </div>
    </div>
  );
};

export default InputGroup;