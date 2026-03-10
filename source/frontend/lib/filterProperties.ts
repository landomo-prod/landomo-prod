import { Property, getDisposition } from "@/types/property";

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

export function filterProperties(
  properties: Property[],
  filters: FilterState
): Property[] {
  return properties.filter((property) => {
    // Price range
    if (property.price < filters.minPrice) return false;
    if (property.price > filters.maxPrice) return false;

    // Area range
    const area = property.sqm ?? 0;
    if (area > 0) {
      if (area < filters.minArea) return false;
      if (area > filters.maxArea) return false;
    }

    // Transaction type (sale/rent)
    if (filters.selectedType && filters.selectedType !== "any") {
      if (
        property.transaction_type &&
        property.transaction_type !== filters.selectedType
      ) {
        return false;
      }
    }

    // Dispositions (Czech-specific)
    if (filters.selectedDispositions.length > 0) {
      const disposition = getDisposition(property);
      if (disposition && !filters.selectedDispositions.includes(disposition)) {
        return false;
      }
    }

    return true;
  });
}
