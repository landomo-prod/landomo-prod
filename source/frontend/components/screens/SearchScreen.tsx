"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, XCircle, MapPin, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSearchContext } from "@/contexts/SearchContext";
import { searchProperties } from "@/lib/api/client";
import { adaptProperties, type Property, formatPrice, getPropertyAddress } from "@/types/property";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import { LocationSuggestion } from "@/lib/api/types";

const TYPE_LABELS: Record<string, string> = {
  region: 'Region',
  district: 'District',
  municipality: 'City',
  neighbourhood: 'Neighbourhood',
  street: 'Street',
  address: 'Address',
};

interface SearchScreenProps {
  onNavigate?: (screen: string) => void;
  onLocationSelect?: (suggestion: LocationSuggestion) => void;
}

export function SearchScreen({ onNavigate, onLocationSelect }: SearchScreenProps) {
  const { setSearchQuery, setSelectedPropertyId } = useSearchContext();
  const [searchValue, setSearchValue] = useState("");
  const [propertySuggestions, setPropertySuggestions] = useState<Property[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const { suggestions: locationSuggestions } = useLocationAutocomplete(searchValue);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPropertySuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchProperties({
        countries: ['czech'],
        filters: { search_query: query },
        limit: 4,
        sort_by: 'date_newest',
      });
      setPropertySuggestions(adaptProperties(response.results));
    } catch {
      setPropertySuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setSearchValue(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleClear = () => {
    setSearchValue("");
    setPropertySuggestions([]);
    onNavigate?.("map");
  };

  const handleLocationClick = (suggestion: LocationSuggestion) => {
    if (onLocationSelect) {
      onLocationSelect(suggestion);
      onNavigate?.("map");
    } else {
      // Fallback: use the label as a search query
      setSearchQuery(suggestion.label);
      const isArea = ['region', 'district', 'municipality', 'neighbourhood'].includes(suggestion.type);
      onNavigate?.(isArea ? "list" : "map");
    }
  };

  const handleSearchSubmit = () => {
    if (searchValue.trim()) {
      setSearchQuery(searchValue.trim());
      onNavigate?.("list");
    }
  };

  const handleSuggestionClick = (property: Property) => {
    setSelectedPropertyId(property.id);
    onNavigate?.("detail");
  };

  const handleLocationSearch = (city: string) => {
    setSearchQuery(city);
    onNavigate?.("list");
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const popularCities = [
    { name: "Praha", subtitle: "Capital • Czech Republic" },
    { name: "Brno", subtitle: "City • South Moravia" },
    { name: "Ostrava", subtitle: "City • Moravia-Silesia" },
    { name: "Plzeň", subtitle: "City • West Bohemia" },
    { name: "Liberec", subtitle: "City • North Bohemia" },
  ];

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Search Bar */}
      <div className="absolute left-0 right-0 top-14 z-20 px-4">
        <div className="flex gap-2 bg-white pb-3 pt-1">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-50 bg-white px-5 py-3">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search address, city..."
              value={searchValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              className="h-auto border-0 bg-transparent p-0 text-[15px] font-medium text-gray-800 placeholder:text-gray-400 focus-visible:ring-0"
            />
          </div>

          <button
            onClick={handleClear}
            className="flex h-12 w-12 items-center justify-center"
          >
            <XCircle className="h-6 w-6 text-gray-400 cursor-pointer transition-colors hover:text-gray-600" />
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 translate-y-full bg-gradient-to-b from-white via-white/60 to-transparent"></div>
      </div>

      {/* Results */}
      <div className="scroll-container flex-1 overflow-y-auto no-scrollbar pt-28 px-5">
        {/* Location suggestions */}
        {searchValue.length >= 2 && locationSuggestions.length > 0 && (
          <>
            <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
              Places
            </h4>
            <div className="space-y-4 mb-8">
              {locationSuggestions.map((suggestion) => {
                const isArea = ['region', 'district', 'municipality', 'neighbourhood'].includes(suggestion.type);
                return (
                  <button
                    key={suggestion.id}
                    onClick={() => handleLocationClick(suggestion)}
                    className="flex w-full items-center gap-4 transition-opacity active:opacity-50"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${isArea ? 'border-lime-200 bg-lime-50' : 'border-gray-100 bg-gray-50'}`}>
                      {isArea
                        ? <Building2 className="h-5 w-5 text-lime-600" strokeWidth={2.5} />
                        : <MapPin className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
                      }
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-[15px] font-black text-gray-900 truncate">
                        {suggestion.label}
                      </div>
                      <div className="text-xs font-bold text-gray-400">
                        {TYPE_LABELS[suggestion.type] || suggestion.type}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Property search results */}
        {searchValue.length >= 2 && (
          <>
            <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
              {isSearching ? 'Searching...' : propertySuggestions.length > 0 ? 'Properties' : locationSuggestions.length === 0 ? 'No results found' : ''}
            </h4>

            {propertySuggestions.length > 0 && (
              <div className="space-y-4 mb-8">
                {propertySuggestions.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => handleSuggestionClick(property)}
                    className="flex w-full items-center gap-4 transition-opacity active:opacity-50 text-left"
                  >
                    {property.images?.[0] && (
                      <img
                        src={property.images[0]}
                        alt=""
                        className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-black text-gray-900 truncate">
                        {formatPrice(property.price, property.currency)}
                      </div>
                      <div className="text-xs font-bold text-gray-400 truncate">
                        {getPropertyAddress(property)}, {property.city}
                      </div>
                      {property.sqm && (
                        <div className="text-xs font-medium text-gray-400">
                          {property.sqm} m²
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {/* "See all results" button */}
                <button
                  onClick={handleSearchSubmit}
                  className="w-full text-center py-3 text-sm font-bold text-[#84CC16] hover:underline"
                >
                  See all results for &ldquo;{searchValue}&rdquo;
                </button>
              </div>
            )}
          </>
        )}

        {/* Popular cities (shown when no search) */}
        {searchValue.length < 2 && (
          <>
            <h4 className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
              Popular Cities
            </h4>

            <div className="space-y-6">
              {popularCities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleLocationSearch(city.name)}
                  className="flex w-full items-center gap-5 transition-opacity active:opacity-50"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-100 bg-gray-50">
                    <MapPin className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <div className="text-[15px] font-black text-gray-900">
                      {city.name}
                    </div>
                    <div className="text-xs font-bold text-gray-400">
                      {city.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
