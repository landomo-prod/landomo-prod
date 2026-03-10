'use client';

import { Property } from '@/types/property';
import { ApartmentDetail } from './ApartmentDetail';
import { HouseDetail } from './HouseDetail';
import { LandDetail } from './LandDetail';
import { CommercialDetail } from './CommercialDetail';
import { OtherDetail } from './OtherDetail';

interface CategoryDetailProps {
  property: Property;
}

export function CategoryDetail({ property }: CategoryDetailProps) {
  switch (property.property_category) {
    case 'apartment':
      return <ApartmentDetail property={property} />;
    case 'house':
      return <HouseDetail property={property} />;
    case 'land':
      return <LandDetail property={property} />;
    case 'commercial':
      return <CommercialDetail property={property} />;
    case 'other':
      return <OtherDetail property={property} />;
    default:
      return <OtherDetail property={property} />;
  }
}
