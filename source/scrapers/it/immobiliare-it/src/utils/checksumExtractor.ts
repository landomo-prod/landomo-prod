import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { ImmobiliareResult } from '../types/immobiliareTypes';

function getProperty(result: ImmobiliareResult) {
  return result.properties?.[0];
}

export function extractImmobiliareChecksumFields(result: ImmobiliareResult): ChecksumFields {
  const prop = getProperty(result);
  return {
    price: prop?.price?.value ?? null,
    title: result.realEstate?.title ?? null,
    description: prop?.description?.substring(0, 100) ?? null,
    sqm: prop?.surface_value ? parseFloat(prop.surface_value) : null,
    disposition: prop?.typologyGA4Translation ?? null,
    purpose: result.realEstate?.contract ?? null,
  };
}

export function createImmobiliareChecksum(result: ImmobiliareResult): ListingChecksum {
  const portalId = String(result.realEstate.id);
  if (!portalId) throw new Error('Result missing realEstate.id');
  return createListingChecksum('immobiliare-it', portalId, result, extractImmobiliareChecksumFields);
}

export function batchCreateImmobiliareChecksums(results: ImmobiliareResult[]): ListingChecksum[] {
  return results.map(createImmobiliareChecksum);
}
