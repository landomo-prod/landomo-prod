"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceRangeSelector } from "@/components/PriceRangeSelector";
import { useSearchContext } from "@/contexts/SearchContext";
import { defaultFilterState } from "@/contexts/SearchContext";

// Category-specific feature lists
const FEATURES_BY_CATEGORY: Record<string, string[]> = {
  flat: ["Parking", "Balcony", "Terrace", "Elevator", "Cellar", "Garage"],
  house: ["Parking", "Terrace", "Garden", "Garage"],
  commercial: ["Parking", "Elevator"],
};

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

interface FiltersScreenProps {
  onNavigate?: (screen: string) => void;
}

export function FiltersScreen({ onNavigate }: FiltersScreenProps) {
  const { filterState, setFilterState, total, isLoading } = useSearchContext();

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

  const cat = selectedCategory;

  // Sub-categories based on selected category
  const subCategories = cat === 'land' ? LAND_SUB_CATEGORIES
    : cat === 'commercial' ? COMMERCIAL_SUB_CATEGORIES
    : null;
  const showSubCategory = cat === 'land' || cat === 'commercial';

  const dispositions = ["1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+"];
  const types = ["Sale", "Rent"];
  const categories = ["Flat", "House", "Land", "Commercial", "Other"];
  const energyRatings = ["A", "B", "C", "D", "E", "F", "G"];
  const floors = ["Ground", "1-3", "4-7", "8+", "Top floor"];
  const conditions = ["New", "Renovated", "Good", "Original", "Reconstruction"];
  const features = FEATURES_BY_CATEGORY[cat] || ["Parking", "Balcony", "Terrace", "Garden", "Elevator", "Cellar", "Garage"];
  const furnishedOptions = ["Any", "Furnished", "Unfurnished", "Partially"];
  const ownershipOptions = [
    { value: "personal", label: "Personal" },
    { value: "cooperative", label: "Cooperative" },
    { value: "state", label: "State" },
    { value: "other", label: "Other" },
  ];
  const constructionTypeOptions = ["Brick", "Panel", "Wood", "Concrete", "Mixed", "Stone", "Prefab"];

  // Visibility helpers
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

  const updateFilter = (partial: Partial<typeof filterState>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
  };

  const handleReset = () => {
    setFilterState(defaultFilterState);
  };

  const toggleArrayItem = (key: keyof typeof filterState, value: string) => {
    const arr = filterState[key] as string[];
    const updated = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    updateFilter({ [key]: updated });
  };

  const selectCategory = (category: string) => {
    const newCat = selectedCategory === category ? '' : category;
    setFilterState(prev => ({
      ...prev,
      selectedCategory: newCat,
      selectedSubCategory: '',
      selectedDispositions: [],
      selectedFloors: [],
      selectedEnergyRatings: [],
      selectedFeatures: [],
      selectedFurnished: 'any',
      selectedPlotAreaMin: 0,
      selectedPlotAreaMax: 0,
    }));
  };

  const handleApply = () => {
    onNavigate?.("list");
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Top background cover */}
      <div className="absolute left-0 right-0 top-0 h-28 bg-white z-20"></div>

      {/* Header */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4 pb-4 bg-white">
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-sm font-bold text-gray-600 transition-colors hover:text-gray-900"
          >
            Reset
          </button>
          <h2 className="text-xl font-black">Filters</h2>
          <button
            onClick={() => onNavigate?.("map")}
            className="flex h-12 w-12 items-center justify-center"
          >
            <X className="h-6 w-6 text-gray-400 cursor-pointer transition-colors hover:text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filters Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pt-32 px-4 pb-32">
        {/* Category — single-select */}
        <div className="mb-10">
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">
              {cat === 'land' ? 'Land type' : 'Property type'}
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {subCategories.map((sub) => {
                const isSelected = selectedSubCategory === sub.value;
                return (
                  <button
                    key={sub.value}
                    onClick={() => updateFilter({ selectedSubCategory: isSelected ? '' : sub.value })}
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

        {/* Price Range */}
        <div className="mb-10">
          <h4 className="mb-4 text-base font-black">Price range</h4>
          <PriceRangeSelector
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinChange={(v) => updateFilter({ minPrice: v })}
            onMaxChange={(v) => updateFilter({ maxPrice: v })}
            min={0}
            max={selectedType === 'rent' ? 200000 : 50000000}
            step={selectedType === 'rent' ? 1000 : 100000}
          />
        </div>

        {/* Type */}
        <div className="mb-10">
          <h4 className="mb-4 text-base font-black">Type</h4>
          <div className="flex flex-wrap gap-2.5">
            {types.map((type) => {
              const isSelected = selectedType === type.toLowerCase();
              return (
                <button
                  key={type}
                  onClick={() => updateFilter({ selectedType: isSelected ? '' : type.toLowerCase() })}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Disposition</h4>
            <div className="flex flex-wrap gap-2.5">
              {dispositions.map((disposition) => {
                const isSelected = selectedDispositions.includes(disposition);
                return (
                  <button
                    key={disposition}
                    onClick={() => toggleArrayItem('selectedDispositions', disposition)}
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
          <div className="mb-10">
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Floor level</h4>
            <div className="flex flex-wrap gap-2.5">
              {floors.map((floor) => {
                const isSelected = selectedFloors.includes(floor);
                return (
                  <button
                    key={floor}
                    onClick={() => toggleArrayItem('selectedFloors', floor)}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Condition</h4>
            <div className="flex flex-wrap gap-2.5">
              {conditions.map((condition) => {
                const isSelected = selectedConditions.includes(condition);
                return (
                  <button
                    key={condition}
                    onClick={() => toggleArrayItem('selectedConditions', condition)}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Energy rating</h4>
            <div className="flex flex-wrap gap-2.5">
              {energyRatings.map((rating) => {
                const isSelected = selectedEnergyRatings.includes(rating);
                return (
                  <button
                    key={rating}
                    onClick={() => toggleArrayItem('selectedEnergyRatings', rating)}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Features</h4>
            <div className="flex flex-wrap gap-2.5">
              {features.map((feature) => {
                const isSelected = selectedFeatures.includes(feature);
                return (
                  <button
                    key={feature}
                    onClick={() => toggleArrayItem('selectedFeatures', feature)}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Furnished</h4>
            <div className="flex flex-wrap gap-2.5">
              {furnishedOptions.map((option) => {
                const isSelected = selectedFurnished === option.toLowerCase();
                return (
                  <button
                    key={option}
                    onClick={() => updateFilter({ selectedFurnished: option.toLowerCase() })}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Ownership</h4>
            <div className="flex flex-wrap gap-2.5">
              {ownershipOptions.map((opt) => {
                const isSelected = selectedOwnership === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter({ selectedOwnership: isSelected ? '' : opt.value })}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Construction type</h4>
            <div className="flex flex-wrap gap-2.5">
              {constructionTypeOptions.map((type) => {
                const isSelected = selectedConstructionTypes.includes(type.toLowerCase());
                return (
                  <button
                    key={type}
                    onClick={() => toggleArrayItem('selectedConstructionTypes', type.toLowerCase())}
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
          <div className="mb-10">
            <h4 className="mb-4 text-base font-black">Year built</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="From"
                  min="1800"
                  max="2030"
                  value={selectedYearBuiltMin || ''}
                  onChange={(e) => updateFilter({ selectedYearBuiltMin: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => updateFilter({ selectedYearBuiltMax: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => updateFilter({ selectedPlotAreaMin: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => updateFilter({ selectedPlotAreaMax: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-center focus:outline-none focus:border-gray-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="absolute bottom-[30px] left-0 right-0 flex justify-center z-50">
        <Button
          onClick={handleApply}
          className="h-16 rounded-full bg-[#84CC16] px-8 text-base font-black text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)] transition-transform hover:bg-[#6aaa10]"
        >
          {isLoading ? 'Searching...' : `Show ${total.toLocaleString()} properties`}
        </Button>
      </div>
    </div>
  );
}
