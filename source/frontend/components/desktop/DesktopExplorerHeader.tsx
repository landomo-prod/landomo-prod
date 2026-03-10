"use client";

import { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, ChevronDown, X, MapPin, Clock, ArrowUpDown, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalNavigation } from "@/components/PortalNavigation";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import { LocationSuggestion } from "@/lib/api/types";
import { PriceRangeSelector } from "@/components/PriceRangeSelector";

interface FilterState {
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

type SortOption = "newest" | "price-low" | "price-high" | "area-large" | "area-small";

interface DesktopExplorerHeaderProps {
  placeholder?: string;
  onFilterClick: () => void;
  showFilterButton?: boolean;
  showPriorityFilters?: boolean;
  filterState?: FilterState;
  onFilterChange?: (filterState: FilterState) => void;
  onNavigateToLanding?: () => void;
  propertyCount?: number;
  sortBy?: SortOption;
  onSortChange?: (sortBy: SortOption) => void;
  showSortButton?: boolean;
  /** When true, hides the PortalNavigation top row (used when nav lives in a parent top bar) */
  showPortalNav?: boolean;
  onLocationSelect?: (suggestion: LocationSuggestion) => void;
}

/**
 * DesktopExplorerHeader - Shared header for desktop explorer views
 *
 * Two-row header layout:
 * 1. Portal navigation (Buy, Rent, Sell, Log in)
 * 2. Search bar + filters in same row
 *
 * Consistent header across Map, List, Saved, and Notifications views.
 */
const TYPE_LABELS: Record<LocationSuggestion['type'], string> = {
  region: 'Region',
  district: 'District',
  municipality: 'City',
  neighbourhood: 'Neighbourhood',
  street: 'Street',
  address: 'Address',
};

export function DesktopExplorerHeader({
  placeholder = "Search by district, street, or ZIP code...",
  onFilterClick,
  showFilterButton = true,
  showPriorityFilters = false,
  filterState,
  onFilterChange,
  onNavigateToLanding,
  propertyCount,
  sortBy = "newest",
  onSortChange,
  showSortButton = false,
  showPortalNav = true,
  onLocationSelect,
}: DesktopExplorerHeaderProps) {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showPlotAreaModal, setShowPlotAreaModal] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, right: 0 });

  // Search suggestions state
  const [searchInput, setSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const priceButtonRef = useRef<HTMLButtonElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
  const dispositionButtonRef = useRef<HTMLButtonElement>(null);
  const areaButtonRef = useRef<HTMLButtonElement>(null);
  const floorButtonRef = useRef<HTMLButtonElement>(null);
  const plotAreaButtonRef = useRef<HTMLButtonElement>(null);
  const subCategoryButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Pelias autocomplete
  const { suggestions: locationSuggestions, isLoading: suggestionsLoading } = useLocationAutocomplete(searchInput);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("recentSearches");
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle ESC key to close suggestions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showSuggestions) {
        setShowSuggestions(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions]);

  // Split suggestions into areas vs addresses
  const areaSuggestions = locationSuggestions.filter(s => ['region', 'district', 'municipality', 'neighbourhood'].includes(s.type));
  const addressSuggestions = locationSuggestions.filter(s => ['street', 'address'].includes(s.type));

  // Save search to recent searches
  const saveRecentSearch = (search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setShowSuggestions(true);
  };

  // Handle location suggestion click
  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    setSearchInput(suggestion.label);
    saveRecentSearch(suggestion.label);
    setShowSuggestions(false);
    onLocationSelect?.(suggestion);
  };

  // Handle recent search click (plain string)
  const handleRecentClick = (search: string) => {
    setSearchInput(search);
    setShowSuggestions(false);
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    setShowSuggestions(true);
  };

  const handleCategoryClick = () => {
    if (categoryButtonRef.current) {
      const rect = categoryButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowCategoryModal(true);
  };

  const getCategoryLabel = () => {
    if (!filterState || !filterState.selectedCategory) return "All";
    const labels: Record<string, string> = {
      flat: "Apartment",
      house: "House",
      land: "Land",
      commercial: "Commercial",
      other: "Other",
    };
    return labels[filterState.selectedCategory] || "All";
  };

  const handlePriceClick = () => {
    if (priceButtonRef.current) {
      const rect = priceButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowPriceModal(true);
  };

  const handleTypeClick = () => {
    if (typeButtonRef.current) {
      const rect = typeButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowTypeModal(true);
  };

  const handleDispositionClick = () => {
    if (dispositionButtonRef.current) {
      const rect = dispositionButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowDispositionModal(true);
  };

  const handleAreaClick = () => {
    if (areaButtonRef.current) {
      const rect = areaButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowAreaModal(true);
  };

  const handleFloorClick = () => {
    if (floorButtonRef.current) {
      const rect = floorButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowFloorModal(true);
  };

  const handlePlotAreaClick = () => {
    if (plotAreaButtonRef.current) {
      const rect = plotAreaButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowPlotAreaModal(true);
  };

  const handleSubCategoryClick = () => {
    if (subCategoryButtonRef.current) {
      const rect = subCategoryButtonRef.current.getBoundingClientRect();
      setModalPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowSubCategoryModal(true);
  };

  const getPriceLabel = () => {
    if (!filterState) return "Any";
    if (filterState.minPrice === 0 && filterState.maxPrice >= priceMax) return "Any";
    const fmt = (v: number) => v.toLocaleString("cs-CZ");
    const minStr = filterState.minPrice === 0 ? "0" : `${fmt(filterState.minPrice)} Kč`;
    const maxStr = filterState.maxPrice >= priceMax ? "∞" : `${fmt(filterState.maxPrice)} Kč`;
    return `${minStr} – ${maxStr}`;
  };

  const getTypeLabel = () => {
    if (!filterState || !filterState.selectedType) return "Rent";
    return filterState.selectedType === "sale" ? "Sale" : "Rent";
  };

  const getDispositionLabel = () => {
    if (!filterState || filterState.selectedDispositions.length === 0) return "Any";
    if (filterState.selectedDispositions.length === 1) return filterState.selectedDispositions[0];
    return `${filterState.selectedDispositions.length} selected`;
  };

  const getAreaLabel = () => {
    if (!filterState) return "Any";
    if (filterState.minArea === 0 && filterState.maxArea === 500) return "Any";
    return `${filterState.minArea}-${filterState.maxArea} m²`;
  };

  const getFloorLabel = () => {
    if (!filterState || filterState.selectedFloors.length === 0) return "Any";
    if (filterState.selectedFloors.length === 1) return filterState.selectedFloors[0];
    return `${filterState.selectedFloors.length} selected`;
  };

  const getPlotAreaLabel = () => {
    if (!filterState) return "Any";
    if (filterState.selectedPlotAreaMin === 0 && filterState.selectedPlotAreaMax === 0) return "Any";
    const min = filterState.selectedPlotAreaMin;
    const max = filterState.selectedPlotAreaMax;
    if (min > 0 && max > 0) return `${min}–${max} m²`;
    if (min > 0) return `${min}+ m²`;
    if (max > 0) return `Up to ${max} m²`;
    return "Any";
  };

  const getSubCategoryLabel = () => {
    if (!filterState || !filterState.selectedSubCategory) return "Any";
    const allSubs = [...LAND_SUB_CATEGORIES, ...COMMERCIAL_SUB_CATEGORIES];
    const found = allSubs.find(s => s.value === filterState.selectedSubCategory);
    return found ? found.label : filterState.selectedSubCategory;
  };

  // Sub-category options
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

  const floorOptions = ["Ground", "1-3", "4-7", "8+", "Top floor"];

  // Priority filter slots per category
  type FilterSlot = 'type' | 'price' | 'disposition' | 'area' | 'floor' | 'plotArea' | 'subCategory';

  const priorityFilters: Record<string, FilterSlot[]> = {
    flat:       ['type', 'price', 'disposition', 'area', 'floor'],
    house:      ['type', 'price', 'disposition', 'area', 'plotArea'],
    land:       ['type', 'price', 'plotArea', 'area'],
    commercial: ['type', 'price', 'subCategory', 'area'],
    other:      ['type', 'price', 'area'],
    '':         ['type', 'price', 'area'],
  };

  const currentCategory = filterState?.selectedCategory || '';
  const activeSlots = priorityFilters[currentCategory] || priorityFilters[''];

  // Price range depends on transaction type
  const isRent = filterState?.selectedType === 'rent';
  const priceMax = isRent ? 200000 : 50000000;
  const priceStep = isRent ? 1000 : 100000;

  const dispositionOptions = ["1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+"];

  const sortLabels: Record<SortOption, string> = {
    newest: "Newest",
    "price-low": "Price ↑",
    "price-high": "Price ↓",
    "area-large": "Area ↓",
    "area-small": "Area ↑",
  };

  // Count active "More" filters (those not shown as quick-filters in header)
  const getMoreFilterCount = () => {
    if (!filterState) return 0;
    let count = 0;
    // Always in "More" (never in bar as quick-filter)
    if (filterState.selectedEnergyRatings.length > 0) count++;
    if (filterState.selectedConditions.length > 0) count++;
    if (filterState.selectedFeatures.length > 0) count++;
    if (filterState.selectedFurnished && filterState.selectedFurnished !== 'any') count++;
    if (filterState.selectedOwnership) count++;
    if (filterState.selectedConstructionTypes.length > 0) count++;
    if (filterState.selectedYearBuiltMin > 0 || filterState.selectedYearBuiltMax > 0) count++;
    // Only count these if NOT shown in bar for current category
    if (!activeSlots.includes('floor') && filterState.selectedFloors.length > 0) count++;
    if (!activeSlots.includes('plotArea') && (filterState.selectedPlotAreaMin > 0 || filterState.selectedPlotAreaMax > 0)) count++;
    if (!activeSlots.includes('subCategory') && filterState.selectedSubCategory) count++;
    // Type and disposition are always in bar when applicable, so don't count them
    return count;
  };

  return (
    <header className="flex flex-col border-b border-gray-100 bg-white z-40">
      {/* Row 1: Portal Navigation — only when not embedded in parent top bar */}
      {showPortalNav && (
        <PortalNavigation
          onLogoClick={onNavigateToLanding}
          hideMapExplorer={true}
          fixed={false}
        />
      )}

      {/* Row 2: Search + Filters */}
      <div className="h-16 flex items-center px-8 gap-4 border-t border-gray-50">
        {/* Search Box */}
        <div
          ref={searchContainerRef}
          className="flex-1 flex max-w-2xl relative group"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors z-10" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={placeholder}
            value={searchInput}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            className="w-full bg-gray-50 border border-gray-200 py-2 pl-10 pr-4 rounded-full outline-none focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50 transition-all text-sm font-medium"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl p-4 z-50 max-h-96 overflow-y-auto">
              {/* Recent Searches Section */}
              {recentSearches.length > 0 && !searchInput.trim() && (
                <div className="mb-4">
                  <div className="text-xs font-black text-gray-400 uppercase mb-3 px-2">
                    Recent Searches
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, index) => (
                      <button
                        key={`recent-${index}`}
                        onClick={() => handleRecentClick(search)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 rounded-xl transition-colors text-left"
                      >
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pelias Location Suggestions */}
              {searchInput.trim() && (
                <div>
                  {suggestionsLoading ? (
                    <div className="px-3 py-6 flex items-center justify-center gap-2 text-sm font-bold text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </div>
                  ) : locationSuggestions.length > 0 ? (
                    <>
                      {/* Areas Section */}
                      {areaSuggestions.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-black text-gray-400 uppercase mb-2 px-2">Areas</div>
                          <div className="space-y-1">
                            {areaSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 rounded-xl transition-colors text-left"
                              >
                                <Building2 className="w-4 h-4 text-[#84CC16] flex-shrink-0" />
                                <span className="flex-1">{suggestion.label}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{TYPE_LABELS[suggestion.type]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Addresses Section */}
                      {addressSuggestions.length > 0 && (
                        <div>
                          <div className="text-xs font-black text-gray-400 uppercase mb-2 px-2">Addresses</div>
                          <div className="space-y-1">
                            {addressSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 rounded-xl transition-colors text-left"
                              >
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="flex-1">{suggestion.label}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{TYPE_LABELS[suggestion.type]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-3 py-6 text-center text-sm font-bold text-gray-400">
                      No locations found
                    </div>
                  )}
                </div>
              )}

              {/* Empty state — show hint when no input and no recent */}
              {!searchInput.trim() && recentSearches.length === 0 && (
                <div className="px-3 py-4 text-center text-sm font-medium text-gray-400">
                  Search for a city, district, or address...
                </div>
              )}
            </div>
          )}
        </div>


        {/* Filters in same row */}
        {showFilterButton && (
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {showPriorityFilters ? (
            <>
              {/* Category — always first */}
              <button
                ref={categoryButtonRef}
                onClick={handleCategoryClick}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                  filterState?.selectedCategory
                    ? "bg-gray-900 text-white border border-gray-900"
                    : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span>{getCategoryLabel()}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Dynamic priority filters based on category */}
              {activeSlots.map((slot) => {
                switch (slot) {
                  case 'type':
                    return (
                      <button
                        key="type"
                        ref={typeButtonRef}
                        onClick={handleTypeClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          filterState?.selectedType
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>{getTypeLabel()}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'price':
                    return (
                      <button
                        key="price"
                        ref={priceButtonRef}
                        onClick={handlePriceClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          getPriceLabel() !== "Any"
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>Price: {getPriceLabel()}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'disposition':
                    return (
                      <button
                        key="disposition"
                        ref={dispositionButtonRef}
                        onClick={handleDispositionClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          filterState?.selectedDispositions && filterState.selectedDispositions.length > 0
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>Disposition{filterState?.selectedDispositions && filterState.selectedDispositions.length > 0 ? ` (${filterState.selectedDispositions.length})` : ''}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'area':
                    return (
                      <button
                        key="area"
                        ref={areaButtonRef}
                        onClick={handleAreaClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          getAreaLabel() !== "Any"
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>Area: {getAreaLabel()}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'floor':
                    return (
                      <button
                        key="floor"
                        ref={floorButtonRef}
                        onClick={handleFloorClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          filterState?.selectedFloors && filterState.selectedFloors.length > 0
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>Floor{filterState?.selectedFloors && filterState.selectedFloors.length > 0 ? `: ${getFloorLabel()}` : ''}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'plotArea':
                    return (
                      <button
                        key="plotArea"
                        ref={plotAreaButtonRef}
                        onClick={handlePlotAreaClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          getPlotAreaLabel() !== "Any"
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>Plot{getPlotAreaLabel() !== "Any" ? `: ${getPlotAreaLabel()}` : ''}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  case 'subCategory':
                    return (
                      <button
                        key="subCategory"
                        ref={subCategoryButtonRef}
                        onClick={handleSubCategoryClick}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                          filterState?.selectedSubCategory
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span>{getSubCategoryLabel() === 'Any' ? 'Sub-type' : getSubCategoryLabel()}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    );
                  default:
                    return null;
                }
              })}

              {/* More Filters — always last */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onFilterClick}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                  getMoreFilterCount() > 0
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>More{getMoreFilterCount() > 0 ? ` (${getMoreFilterCount()})` : ''}</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 border-gray-200 rounded-full hover:border-blue-300 hover:text-[#84CC16] hover:bg-lime-50 transition-all whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>All Filters</span>
            </Button>
          )}
          </div>
        )}

        {/* Sort Button */}
        {showSortButton && onSortChange && (
          <button
            ref={sortButtonRef}
            onClick={() => {
              if (sortButtonRef.current) {
                const rect = sortButtonRef.current.getBoundingClientRect();
                setSortMenuPosition({
                  top: rect.bottom + 8,
                  right: window.innerWidth - rect.right,
                });
                setShowSortMenu(!showSortMenu);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-full hover:border-gray-300 hover:bg-gray-50 transition-all whitespace-nowrap ml-auto"
          >
            {sortLabels[sortBy]} <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Category Modal */}
      {showCategoryModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowCategoryModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Category</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { value: 'flat', label: 'Apartment' },
                { value: 'house', label: 'House' },
                { value: 'land', label: 'Land' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'other', label: 'Other' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    if (!filterState || !onFilterChange) return;
                    const newCat = cat.value;
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
                    setShowCategoryModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    filterState?.selectedCategory === cat.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Price Modal */}
      {showPriceModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowPriceModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Price Range</h3>
              <button
                onClick={() => setShowPriceModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <PriceRangeSelector
              minPrice={filterState?.minPrice || 0}
              maxPrice={filterState?.maxPrice || priceMax}
              onMinChange={(value) => onFilterChange?.({ ...filterState!, minPrice: value })}
              onMaxChange={(value) => onFilterChange?.({ ...filterState!, maxPrice: value })}
              onRangeChange={(newMin, newMax) => onFilterChange?.({ ...filterState!, minPrice: newMin, maxPrice: newMax })}
              min={0}
              max={priceMax}
              step={priceStep}
              presets={isRent ? [
                { label: "0–15k", min: 0, max: 15000 },
                { label: "15–25k", min: 15000, max: 25000 },
                { label: "25–50k", min: 25000, max: 50000 },
                { label: "50k+", min: 50000, max: 200000 },
              ] : undefined}
            />

            <button
              onClick={() => setShowPriceModal(false)}
              className="w-full mt-6 bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}

      {/* Type Modal */}
      {showTypeModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowTypeModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Transaction Type</h3>
              <button
                onClick={() => setShowTypeModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { value: 'sale', label: 'Sale' },
                { value: 'rent', label: 'Rent' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    // When switching between sale/rent, reset price if it exceeds the new max
                    const newType = type.value;
                    const newIsRent = newType === 'rent';
                    const newPriceMax = newIsRent ? 200000 : 50000000;
                    const updatedState = { ...filterState!, selectedType: newType };
                    // Clamp prices to new range
                    if (updatedState.maxPrice > newPriceMax) updatedState.maxPrice = newPriceMax;
                    if (updatedState.minPrice > newPriceMax) updatedState.minPrice = 0;
                    onFilterChange?.(updatedState);
                    setShowTypeModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    filterState?.selectedType === type.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Disposition Modal */}
      {showDispositionModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowDispositionModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Disposition</h3>
              <button
                onClick={() => setShowDispositionModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              {dispositionOptions.map((disposition) => (
                <button
                  key={disposition}
                  onClick={() => {
                    const current = filterState?.selectedDispositions || [];
                    const newDispositions = current.includes(disposition)
                      ? current.filter((d) => d !== disposition)
                      : [...current, disposition];
                    onFilterChange?.({ ...filterState!, selectedDispositions: newDispositions });
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    filterState?.selectedDispositions?.includes(disposition)
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {disposition}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDispositionModal(false)}
              className="w-full mt-4 bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}

      {/* Area Modal */}
      {showAreaModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowAreaModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Area Range</h3>
              <button
                onClick={() => setShowAreaModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">Min Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={filterState?.minArea || 0}
                  onChange={(e) =>
                    onFilterChange?.({ ...filterState!, minArea: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">Max Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={filterState?.maxArea || 500}
                  onChange={(e) =>
                    onFilterChange?.({ ...filterState!, maxArea: parseInt(e.target.value) || 500 })
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              <button
                onClick={() => setShowAreaModal(false)}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floor Modal */}
      {showFloorModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowFloorModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Floor Level</h3>
              <button
                onClick={() => setShowFloorModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              {floorOptions.map((floor) => (
                <button
                  key={floor}
                  onClick={() => {
                    const current = filterState?.selectedFloors || [];
                    const newFloors = current.includes(floor)
                      ? current.filter((f) => f !== floor)
                      : [...current, floor];
                    onFilterChange?.({ ...filterState!, selectedFloors: newFloors });
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    filterState?.selectedFloors?.includes(floor)
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {floor}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFloorModal(false)}
              className="w-full mt-4 bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}

      {/* Plot Area Modal */}
      {showPlotAreaModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowPlotAreaModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Plot Area</h3>
              <button
                onClick={() => setShowPlotAreaModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">Min Plot Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  value={filterState?.selectedPlotAreaMin || 0}
                  onChange={(e) =>
                    onFilterChange?.({ ...filterState!, selectedPlotAreaMin: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">Max Plot Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  value={filterState?.selectedPlotAreaMax || 0}
                  onChange={(e) =>
                    onFilterChange?.({ ...filterState!, selectedPlotAreaMax: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-gray-400"
                  placeholder="No limit"
                />
              </div>

              <button
                onClick={() => setShowPlotAreaModal(false)}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sub-category Modal */}
      {showSubCategoryModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200]"
            onClick={() => setShowSubCategoryModal(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px` }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Sub-type</h3>
              <button
                onClick={() => setShowSubCategoryModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              {(currentCategory === 'land' ? LAND_SUB_CATEGORIES : COMMERCIAL_SUB_CATEGORIES).map((sub) => (
                <button
                  key={sub.value}
                  onClick={() => {
                    const isSelected = filterState?.selectedSubCategory === sub.value;
                    onFilterChange?.({ ...filterState!, selectedSubCategory: isSelected ? '' : sub.value });
                    setShowSubCategoryModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    filterState?.selectedSubCategory === sub.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sort Menu */}
      {showSortMenu && onSortChange && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[200] transition-opacity"
            onClick={() => setShowSortMenu(false)}
          />
          <div
            className="fixed z-[201] bg-white rounded-3xl shadow-2xl p-6 w-[320px]"
            style={{
              top: `${sortMenuPosition.top}px`,
              right: `${sortMenuPosition.right}px`,
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Sort by</h3>
              <button
                onClick={() => setShowSortMenu(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  onSortChange("newest");
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                  sortBy === "newest"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
                Newest First
              </button>
              <button
                onClick={() => {
                  onSortChange("price-low");
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                  sortBy === "price-low"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
                Price: Low to High
              </button>
              <button
                onClick={() => {
                  onSortChange("price-high");
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                  sortBy === "price-high"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
              Price: High to Low
              </button>
              <button
                onClick={() => {
                  onSortChange("area-large");
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                  sortBy === "area-large"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
                Area: Largest First
              </button>
              <button
                onClick={() => {
                  onSortChange("area-small");
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
                  sortBy === "area-small"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100"
                }`}
              >
                Area: Smallest First
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
