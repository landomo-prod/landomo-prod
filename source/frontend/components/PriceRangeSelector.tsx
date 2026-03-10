"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface PricePreset {
  label: string;
  min: number;
  max: number;
}

interface PriceRangeSelectorProps {
  minPrice: number;
  maxPrice: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  onRangeChange?: (min: number, max: number) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: PricePreset[];
}

export function PriceRangeSelector({
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  onRangeChange,
  min = 0,
  max = 50000000,
  step = 500000,
  presets,
}: PriceRangeSelectorProps) {
  const [isEditingMin, setIsEditingMin] = useState(false);
  const [isEditingMax, setIsEditingMax] = useState(false);
  const [tempMinValue, setTempMinValue] = useState(minPrice.toString());
  const [tempMaxValue, setTempMaxValue] = useState(maxPrice.toString());

  const formatPrice = (price: number, position?: 'min' | 'max') => {
    if (position === 'min' && price === min) return "0 Kč";
    if (position === 'max' && price === max) return "∞";
    return `${price.toLocaleString("cs-CZ")} Kč`;
  };

  const handleMinInputChange = (value: string) => {
    setTempMinValue(value);
    const numValue = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numValue) && numValue <= maxPrice) {
      onMinChange(numValue);
    }
  };

  const handleMaxInputChange = (value: string) => {
    setTempMaxValue(value);
    const numValue = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numValue) && numValue >= minPrice) {
      onMaxChange(numValue);
    }
  };

  const handleMinBlur = () => {
    setIsEditingMin(false);
    setTempMinValue(minPrice.toString());
  };

  const handleMaxBlur = () => {
    setIsEditingMax(false);
    setTempMaxValue(maxPrice.toString());
  };

  const defaultPresets: PricePreset[] = [
    { label: "0–5M", min: 0, max: 5000000 },
    { label: "5–10M", min: 5000000, max: 10000000 },
    { label: "10–15M", min: 10000000, max: 15000000 },
    { label: "15M+", min: 15000000, max: 50000000 },
  ];

  const presetRanges = presets || defaultPresets;

  const handlePresetClick = (presetMin: number, presetMax: number) => {
    onMinChange(presetMin);
    onMaxChange(presetMax);
  };

  return (
    <div className="space-y-6">
      {/* Current Values */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center cursor-pointer transition-colors hover:bg-gray-100"
          onClick={() => setIsEditingMin(true)}
        >
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Min
          </span>
          {isEditingMin ? (
            <input
              type="text"
              value={tempMinValue}
              onChange={(e) => handleMinInputChange(e.target.value)}
              onBlur={handleMinBlur}
              autoFocus
              className="w-full bg-transparent text-center text-sm font-black outline-none"
            />
          ) : (
            <span className="text-sm font-black">
              {formatPrice(minPrice, 'min')}
            </span>
          )}
        </div>
        <div className="h-[1px] w-3 bg-gray-200"></div>
        <div
          className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center cursor-pointer transition-colors hover:bg-gray-100"
          onClick={() => setIsEditingMax(true)}
        >
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Max
          </span>
          {isEditingMax ? (
            <input
              type="text"
              value={tempMaxValue}
              onChange={(e) => handleMaxInputChange(e.target.value)}
              onBlur={handleMaxBlur}
              autoFocus
              className="w-full bg-transparent text-center text-sm font-black outline-none"
            />
          ) : (
            <span className="text-sm font-black">
              {formatPrice(maxPrice, 'max')}
            </span>
          )}
        </div>
      </div>

      {/* Range Slider */}
      <div className="px-2">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[minPrice, maxPrice]}
          onValueChange={([newMin, newMax]) => {
            if (onRangeChange) {
              onRangeChange(newMin, newMax);
            } else {
              onMinChange(newMin);
              onMaxChange(newMax);
            }
          }}
          className="w-full"
        />
        <div className="mt-2 flex justify-between text-xs text-gray-400 font-bold">
          <span>0 Kč</span>
          <span>∞</span>
        </div>
      </div>

      {/* Preset Quick Select */}
      <div className="flex flex-wrap gap-2">
        {presetRanges.map((preset) => {
          const isSelected = minPrice === preset.min && maxPrice === preset.max;
          return (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.min, preset.max)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors border ${
                isSelected
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
