import React, { useState, useEffect } from 'react';

interface NumberInputWithSliderProps {
  id: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  unitPrefix?: string;
  unitSuffix?: string;
  quickPresets?: { label: string; value: number }[];
  helperText?: string;
  formatAsCurrency?: boolean;
}

export const NumberInputWithSlider: React.FC<NumberInputWithSliderProps> = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1000,
  unitPrefix = '',
  unitSuffix = '',
  quickPresets,
  helperText,
  formatAsCurrency = false,
}) => {
  // Local string state to preserve user typing
  const [localText, setLocalText] = useState<string>(() => {
    return formatAsCurrency ? value.toLocaleString('en-US') : value.toString();
  });

  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalText(formatAsCurrency ? value.toLocaleString('en-US') : value.toString());
    }
  }, [value, isFocused, formatAsCurrency]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalText(raw);

    if (min < 0 && (raw === '-' || raw.trim() === '-')) {
      return;
    }

    const clean = raw.replace(min < 0 ? /[^0-9.-]/g : /[^0-9.]/g, '');
    if (clean === '' || clean === '-') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && isFinite(parsed)) {
      const lower = min;
      const upper = Math.max(max, max * 2);
      const bounded = Math.min(Math.max(parsed, lower), upper);
      onChange(bounded);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const clean = localText.replace(min < 0 ? /[^0-9.-]/g : /[^0-9.]/g, '');
    const parsed = parseFloat(clean);
    const lower = min;
    const upper = Math.max(max, max * 2);
    const finalVal = isNaN(parsed) ? (min >= 0 ? min : 0) : Math.min(Math.max(parsed, lower), upper);
    onChange(finalVal);
    setLocalText(formatAsCurrency ? finalVal.toLocaleString('en-US') : finalVal.toString());
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onChange(val);
    setLocalText(formatAsCurrency ? val.toLocaleString('en-US') : val.toString());
  };

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-semibold text-[#172522]">
            {label}
          </label>
          {helperText && (
            <span className="text-xs text-[#52635D]">{helperText}</span>
          )}
        </div>
      )}

      {/* Input container */}
      <div className="relative">
        {unitPrefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] pointer-events-none select-none">
            {unitPrefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={localText}
          onChange={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className={`w-full h-11 bg-white text-[#172522] border border-[#D5DFDA] rounded-xl px-3.5 text-base font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-[#176B52] transition-all ${
            unitPrefix ? 'pl-11' : ''
          } ${unitSuffix ? 'pr-14' : ''}`}
        />
        {unitSuffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#52635D] pointer-events-none select-none">
            {unitSuffix}
          </span>
        )}
      </div>

      {/* Slider row */}
      <div className="pt-1 px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(value, max)}
          onChange={handleSliderChange}
          aria-label={`${label || id} slider`}
          className="w-full h-2 bg-[#D5DFDA] rounded-lg appearance-none cursor-pointer accent-[#176B52] touch-pan-x"
        />
        <div className="flex justify-between text-[11px] text-[#52635D] font-mono tabular-nums pt-1">
          <span>{unitPrefix}{min.toLocaleString()}{unitSuffix}</span>
          <span>{unitPrefix}{max.toLocaleString()}{unitSuffix}</span>
        </div>
      </div>

      {/* Presets if provided */}
      {quickPresets && quickPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {quickPresets.map((preset) => {
            const isSelected = Math.abs(value - preset.value) < step / 2;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange(preset.value);
                  setLocalText(formatAsCurrency ? preset.value.toLocaleString('en-US') : preset.value.toString());
                }}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  isSelected
                    ? 'bg-[#176B52] text-white border-[#176B52]'
                    : 'bg-white text-[#172522] border-[#D5DFDA] hover:border-[#B8C7C0] hover:bg-[#F8FAF9]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
