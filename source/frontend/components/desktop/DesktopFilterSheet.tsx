"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceRangeSelector } from "@/components/PriceRangeSelector";
import { useSearchContext } from "@/contexts/SearchContext";

export interface FilterState {
  minPrice: number;
  maxPrice: number;
  selectedDispositions: string[];
  selectedType: string;
  selectedCategory: string;
  selectedSubCategory: string;
  selectedEnergyRatings: string[];
  minArea: number;
  maxArea: number;
  selectedFloors: string[];
  selectedConditions: string[];
  selectedFeatures: string[];
  selectedFurnished: string;
  selectedOwnership: string;
  selectedConstructionTypes: string[];
  selectedYearBuiltMin: number;
  selectedYearBuiltMax: number;
  selectedPlotAreaMin: number;
  selectedPlotAreaMax: number;
}

// Sub-categories for Land and Commercial
const LAND_SUB_CATEGORIES = [
  { value: 'building_plot', label: 'Building plot' },
  { value: 'field', label: 'Field' },
  { value: 'garden', label: 'Garden' },
  { value: 'forest', label: 'Forest' },
  { value: 'commercial_plot', label: 'Commercial plot' },
  { value: 'meadow', label: 'Meadow' },
  { value: 'orchard', label: 'Orchard' },
  { value: 'water', label: 'Water area' },
];

const COMMERCIAL_SUB_CATEGORIES = [
  { value: 'office', label: 'Office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'retail', label: 'Retail' },
  { value: 'production', label: 'Production' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'apartment_building', label: 'Apartment building' },
  { value: 'medical_office', label: 'Medical office' },
  { value: 'agricultural', label: 'Agricultural' },
];

// Category-specific feature lists
const FEATURES_BY_CATEGORY: Record<string, string[]> = {
  flat: ["Parking", "Balcony", "Terrace", "Elevator", "Cellar", "Garage"],
  house: ["Parking", "Terrace", "Garden", "Garage"],
  commercial: ["Parking", "Elevator"],
};

interface DesktopFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: () => void;
  filterState: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

/**
 * DesktopFilterSheet - Modal wrapper for filter controls
 *
 * Provides a desktop-optimized modal dialog for property filtering.
 * Follows mobile design language (rounded-full, font-black, shadow-xl)
 * while being adapted for larger screens.
 */
export function DesktopFilterSheet({
  open,
  onOpenChange,
  onApply,
  filterState,
  onFilterChange,
}: DesktopFilterSheetProps) {
  const {
    minPrice,
    maxPrice,
    selectedDispositions,
    selectedType,
    selectedCategory,
    selectedSubCategory,
    selectedEnergyRatings,
    minArea,
    maxArea,
    selectedFloors,
    selectedConditions,
    selectedFeatures,
    selectedFurnished,
    selectedOwnership,
    selectedConstructionTypes,
    selectedYearBuiltMin,
    selectedYearBuiltMax,
    selectedPlotAreaMin,
    selectedPlotAreaMax,
  } = filterState;

  const { total, isLoading } = useSearchContext();

  const cat = selectedCategory; // shorthand for visibility checks

  const dispositions = ["1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+"];
  const types = ["Sale", "Rent"];
  const categories = ["Flat", "House", "Land", "Commercial", "Other"];
  const energyRatings = ["A", "B", "C", "D", "E", "F", "G"];
  const floors = ["Ground", "1-3", "4-7", "8+", "Top floor"];
  const conditions = [
    "New",
    "Renovated",
    "Good",
    "Original",
    "Reconstruction",
  ];
  const features = FEATURES_BY_CATEGORY[cat] || ["Parking", "Balcony", "Terrace", "Garden", "Elevator", "Cellar", "Garage"];
  const furnishedOptions = ["Any", "Furnished", "Unfurnished", "Partially"];
  const ownershipOptions = [
    { value: "personal", label: "Personal" },
    { value: "cooperative", label: "Cooperative" },
    { value: "state", label: "State" },
    { value: "other", label: "Other" },
  ];
  const constructionTypeOptions = ["Brick", "Panel", "Wood", "Concrete", "Mixed", "Stone", "Prefab"];

  // Sub-categories based on selected category
  const subCategories = cat === 'land' ? LAND_SUB_CATEGORIES
    : cat === 'commercial' ? COMMERCIAL_SUB_CATEGORIES
    : null;

  // Visibility helpers
  const showSubCategory = cat === 'land' || cat === 'commercial';
  const showDisposition = cat === 'flat' || cat === 'house';
  const showFloors = cat === 'flat';
  const showEnergy = cat === 'flat';
  const showFurnished = cat === 'flat';
  const showArea = !cat || cat === 'flat' || cat === 'house' || cat === 'commercial';
  const showCondition = !cat || cat === 'flat' || cat === 'house' || cat === 'commercial';
  const showConstruction = cat === 'flat' || cat === 'house' || cat === 'commercial';
  const showYearBuilt = cat === 'flat' || cat === 'house' || cat === 'commercial';
  const showFeatures = cat === 'flat' || cat === 'house' || cat === 'commercial';
  const showOwnership = cat === 'flat' || cat === 'house' || cat === 'land';
  const showPlotArea = cat === 'house' || cat === 'land';

  const toggleConstructionType = (type: string) => {
    const val = type.toLowerCase();
    const updated = selectedConstructionTypes.includes(val)
      ? selectedConstructionTypes.filter((t) => t !== val)
      : [...selectedConstructionTypes, val];
    onFilterChange({ ...filterState, selectedConstructionTypes: updated });
  };

  const handleReset = () => {
    onFilterChange({
      minPrice: 0,
      maxPrice: 50000000,
      selectedDispositions: [],
      selectedType: "",
      selectedCategory: "",
      selectedSubCategory: "",
      selectedEnergyRatings: [],
      minArea: 0,
      maxArea: 500,
      selectedFloors: [],
      selectedConditions: [],
      selectedFeatures: [],
      selectedFurnished: "any",
      selectedOwnership: '',
      selectedConstructionTypes: [],
      selectedYearBuiltMin: 0,
      selectedYearBuiltMax: 0,
      selectedPlotAreaMin: 0,
      selectedPlotAreaMax: 0,
    });
  };

  const toggleDisposition = (disposition: string) => {
    const updated = selectedDispositions.includes(disposition)
      ? selectedDispositions.filter((d) => d !== disposition)
      : [...selectedDispositions, disposition];
    onFilterChange({ ...filterState, selectedDispositions: updated });
  };

  const selectCategory = (category: string) => {
    const newCat = selectedCategory === category ? '' : category;
    // Only reset filters incompatible with the new category
    const hasDisposition = newCat === 'flat' || newCat === 'house';
    const hasFloors = newCat === 'flat';
    const hasEnergy = newCat === 'flat';
    const hasFurnished = newCat === 'flat';
    const hasPlotArea = newCat === 'house' || newCat === 'land';
    onFilterChange({
      ...filterState,
      selectedCategory: newCat,
      selectedSubCategory: '',
      selectedDispositions: hasDisposition ? filterState.selectedDispositions : [],
      selectedFloors: hasFloors ? filterState.selectedFloors : [],
      selectedEnergyRatings: hasEnergy ? filterState.selectedEnergyRatings : [],
      selectedFurnished: hasFurnished ? filterState.selectedFurnished : 'any',
      selectedPlotAreaMin: hasPlotArea ? filterState.selectedPlotAreaMin : 0,
      selectedPlotAreaMax: hasPlotArea ? filterState.selectedPlotAreaMax : 0,
    });
  };

  const toggleEnergyRating = (rating: string) => {
    const updated = selectedEnergyRatings.includes(rating)
      ? selectedEnergyRatings.filter((r) => r !== rating)
      : [...selectedEnergyRatings, rating];
    onFilterChange({ ...filterState, selectedEnergyRatings: updated });
  };

  const toggleFloor = (floor: string) => {
    const updated = selectedFloors.includes(floor)
      ? selectedFloors.filter((f) => f !== floor)
      : [...selectedFloors, floor];
    onFilterChange({ ...filterState, selectedFloors: updated });
  };

  const toggleCondition = (condition: string) => {
    const updated = selectedConditions.includes(condition)
      ? selectedConditions.filter((c) => c !== condition)
      : [...selectedConditions, condition];
    onFilterChange({ ...filterState, selectedConditions: updated });
  };

  const toggleFeature = (feature: string) => {
    const updated = selectedFeatures.includes(feature)
      ? selectedFeatures.filter((f) => f !== feature)
      : [...selectedFeatures, feature];
    onFilterChange({ ...filterState, selectedFeatures: updated });
  };

  const handleApply = () => {
    onApply?.();
    onOpenChange(false);
  };

  const resultCount = total;

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[200] transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Filter Modal - Centered on screen */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white rounded-3xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="text-sm font-bold text-gray-600 transition-colors hover:text-gray-900"
            >
              Reset
            </button>
            <h3 className="text-xl font-black">Filters</h3>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-800" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Category — always shown, single-select */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-black">Category</h4>
            <div className="flex flex-wrap gap-2.5">
              {categories.map((category) => {
                const isSelected = selectedCategory === category.toLowerCase();
                return (
                  <button
                    key={category}
                    onClick={() => selectCategory(category.toLowerCase())}
                    className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-category — land/commercial only */}
          {showSubCategory && subCategories && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">
                {cat === 'land' ? 'Land type' : 'Property type'}
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {subCategories.map((sub) => {
                  const isSelected = selectedSubCategory === sub.value;
                  return (
                    <button
                      key={sub.value}
                      onClick={() => onFilterChange({ ...filterState, selectedSubCategory: isSelected ? '' : sub.value })}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Range — always shown */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-black">Price range</h4>
            <PriceRangeSelector
              minPrice={minPrice}
              maxPrice={maxPrice}
              onMinChange={(value) => onFilterChange({ ...filterState, minPrice: value })}
              onMaxChange={(value) => onFilterChange({ ...filterState, maxPrice: value })}
              onRangeChange={(newMin, newMax) => onFilterChange({ ...filterState, minPrice: newMin, maxPrice: newMax })}
              min={0}
              max={selectedType === 'rent' ? 200000 : 50000000}
              step={selectedType === 'rent' ? 1000 : 100000}
              presets={selectedType === 'rent' ? [
                { label: "0–15k", min: 0, max: 15000 },
                { label: "15–25k", min: 15000, max: 25000 },
                { label: "25–50k", min: 25000, max: 50000 },
                { label: "50k+", min: 50000, max: 200000 },
              ] : undefined}
            />
          </div>

          {/* Type — always shown */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-black">Type</h4>
            <div className="flex flex-wrap gap-2.5">
              {types.map((type) => {
                const isSelected = selectedType === type.toLowerCase();
                return (
                  <button
                    key={type}
                    onClick={() => onFilterChange({ ...filterState, selectedType: isSelected ? '' : type.toLowerCase() })}
                    className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disposition — flat only */}
          {showDisposition && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Disposition</h4>
              <div className="flex flex-wrap gap-2.5">
                {dispositions.map((disposition) => {
                  const isSelected = selectedDispositions.includes(disposition);
                  return (
                    <button
                      key={disposition}
                      onClick={() => toggleDisposition(disposition)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {disposition}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Area Range */}
          {showArea && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Area (m²)</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Min
                  </span>
                  <span className="text-sm font-black">{minArea} m²</span>
                </div>
                <div className="h-[1px] w-3 bg-gray-200"></div>
                <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Max
                  </span>
                  <span className="text-sm font-black">{maxArea} m²</span>
                </div>
              </div>
            </div>
          )}

          {/* Floor Level — flat only */}
          {showFloors && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Floor level</h4>
              <div className="flex flex-wrap gap-2.5">
                {floors.map((floor) => {
                  const isSelected = selectedFloors.includes(floor);
                  return (
                    <button
                      key={floor}
                      onClick={() => toggleFloor(floor)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {floor}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Condition */}
          {showCondition && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Condition</h4>
              <div className="flex flex-wrap gap-2.5">
                {conditions.map((condition) => {
                  const isSelected = selectedConditions.includes(condition);
                  return (
                    <button
                      key={condition}
                      onClick={() => toggleCondition(condition)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {condition}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Energy Rating — flat only */}
          {showEnergy && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Energy rating</h4>
              <div className="flex flex-wrap gap-2.5">
                {energyRatings.map((rating) => {
                  const isSelected = selectedEnergyRatings.includes(rating);
                  return (
                    <button
                      key={rating}
                      onClick={() => toggleEnergyRating(rating)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {rating}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Features */}
          {showFeatures && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Features</h4>
              <div className="flex flex-wrap gap-2.5">
                {features.map((feature) => {
                  const isSelected = selectedFeatures.includes(feature);
                  return (
                    <button
                      key={feature}
                      onClick={() => toggleFeature(feature)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {feature}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Furnished — flat only */}
          {showFurnished && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Furnished</h4>
              <div className="flex flex-wrap gap-2.5">
                {furnishedOptions.map((option) => {
                  const isSelected = selectedFurnished === option.toLowerCase();
                  return (
                    <button
                      key={option}
                      onClick={() => onFilterChange({ ...filterState, selectedFurnished: option.toLowerCase() })}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ownership */}
          {showOwnership && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Ownership</h4>
              <div className="flex flex-wrap gap-2.5">
                {ownershipOptions.map((opt) => {
                  const isSelected = selectedOwnership === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onFilterChange({ ...filterState, selectedOwnership: isSelected ? '' : opt.value })}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Construction Type */}
          {showConstruction && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Construction type</h4>
              <div className="flex flex-wrap gap-2.5">
                {constructionTypeOptions.map((type) => {
                  const isSelected = selectedConstructionTypes.includes(type.toLowerCase());
                  return (
                    <button
                      key={type}
                      onClick={() => toggleConstructionType(type)}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Year Built */}
          {showYearBuilt && (
            <div className="mb-8">
              <h4 className="mb-4 text-base font-black">Year built</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="From"
                    min="1800"
                    max="2030"
                    value={selectedYearBuiltMin || ''}
                    onChange={(e) => onFilterChange({ ...filterState, selectedYearBuiltMin: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-center focus:outline-none focus:border-gray-300"
                  />
                </div>
                <div className="h-[1px] w-3 bg-gray-200"></div>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="To"
                    min="1800"
                    max="2030"
                    value={selectedYearBuiltMax || ''}
                    onChange={(e) => onFilterChange({ ...filterState, selectedYearBuiltMax: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-center focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Plot Area */}
          {showPlotArea && (
            <div>
              <h4 className="mb-4 text-base font-black">Plot area (m²)</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Min"
                    min="0"
                    value={selectedPlotAreaMin || ''}
                    onChange={(e) => onFilterChange({ ...filterState, selectedPlotAreaMin: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-center focus:outline-none focus:border-gray-300"
                  />
                </div>
                <div className="h-[1px] w-3 bg-gray-200"></div>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Max"
                    min="0"
                    value={selectedPlotAreaMax || ''}
                    onChange={(e) => onFilterChange({ ...filterState, selectedPlotAreaMax: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-center focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Apply Button */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-center flex-shrink-0">
          <Button
            onClick={handleApply}
            className="h-14 rounded-full bg-[#84CC16] px-8 text-base font-black text-white shadow-xl transition-transform hover:bg-[#6aaa10]"
          >
            {isLoading ? 'Searching...' : `Show ${resultCount.toLocaleString()} properties`}
          </Button>
        </div>
      </div>
    </>
  );
}
