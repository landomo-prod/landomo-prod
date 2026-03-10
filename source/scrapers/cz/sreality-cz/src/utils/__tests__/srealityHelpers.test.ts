/**
 * Unit tests for srealityHelpers
 */

import {
  bedroomsFromDisposition,
  extractDispositionFromTitle,
  mapOwnership,
  extractFloorInfo,
  mapSubType,
  parseArea,
  extractCity,
  isPositiveValue,
  ensureBoolean,
  extractSellerInfo,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl
} from '../srealityHelpers';

describe('srealityHelpers', () => {
  describe('bedroomsFromDisposition()', () => {
    it('should extract bedrooms from Czech disposition', () => {
      expect(bedroomsFromDisposition('1+kk')).toBe(0); // Studio
      expect(bedroomsFromDisposition('2+kk')).toBe(1);
      expect(bedroomsFromDisposition('3+1')).toBe(2);
      expect(bedroomsFromDisposition('4+kk')).toBe(3);
      expect(bedroomsFromDisposition('5+1')).toBe(4);
    });

    it('should handle undefined', () => {
      expect(bedroomsFromDisposition(undefined)).toBeUndefined();
    });

    it('should handle invalid format', () => {
      expect(bedroomsFromDisposition('pokoj')).toBeUndefined();
    });

    it('should handle case insensitive', () => {
      expect(bedroomsFromDisposition('2+KK')).toBe(1);
    });
  });

  describe('extractDispositionFromTitle()', () => {
    it('should extract disposition from title', () => {
      expect(extractDispositionFromTitle('Prodej bytu 2+kk 45 m²')).toBe('2+kk');
      expect(extractDispositionFromTitle('Pronájem bytu 3+1 80 m²')).toBe('3+1');
      expect(extractDispositionFromTitle('Prodej bytu 4+1 132 m² (Mezonet)')).toBe('4+1');
    });

    it('should return undefined if no disposition found', () => {
      expect(extractDispositionFromTitle('Pronájem pokoje 10 m²')).toBeUndefined();
    });

    it('should handle undefined', () => {
      expect(extractDispositionFromTitle(undefined)).toBeUndefined();
    });
  });

  describe('mapOwnership()', () => {
    it('should map Czech ownership types', () => {
      expect(mapOwnership('Osobní')).toBe('personal');
      expect(mapOwnership('Družstevní')).toBe('cooperative');
      expect(mapOwnership('Státní')).toBe('state');
      expect(mapOwnership('Obecní')).toBe('municipal');
      expect(mapOwnership('Městský')).toBe('municipal');
    });

    it('should handle abbreviations', () => {
      expect(mapOwnership('OV')).toBe('personal');
      expect(mapOwnership('DB')).toBe('cooperative');
    });

    it('should be case insensitive', () => {
      expect(mapOwnership('osobní')).toBe('personal');
      expect(mapOwnership('OSOBNÍ')).toBe('personal');
    });

    it('should return undefined for unknown types', () => {
      expect(mapOwnership('Unknown')).toBeUndefined();
      expect(mapOwnership(undefined)).toBeUndefined();
    });
  });

  describe('extractFloorInfo()', () => {
    it('should extract floor from Czech format', () => {
      expect(extractFloorInfo('3. podlaží')).toEqual({ floor: 3 });
      expect(extractFloorInfo('přízemí')).toEqual({ floor: 0 });
      expect(extractFloorInfo('prizemi')).toEqual({ floor: 0 });
    });

    it('should extract floor and total floors from X/Y format', () => {
      expect(extractFloorInfo('3/5')).toEqual({ floor: 3, total_floors: 5 });
      expect(extractFloorInfo('1 / 4')).toEqual({ floor: 1, total_floors: 4 });
    });

    it('should return empty object for invalid format', () => {
      expect(extractFloorInfo('invalid')).toEqual({});
      expect(extractFloorInfo(undefined)).toEqual({});
    });
  });

  describe('mapSubType()', () => {
    it('should map numeric category sub IDs', () => {
      expect(mapSubType(7)).toBe('detached');
      expect(mapSubType(11)).toBe('terraced');
      expect(mapSubType(8)).toBe('semi_detached');
      expect(mapSubType(47)).toBe('villa');
      expect(mapSubType(52)).toBe('farm');
    });

    it('should return undefined for unknown IDs', () => {
      expect(mapSubType(999)).toBeUndefined();
    });

    it('should ignore string SEO slugs', () => {
      expect(mapSubType('byt-2-kk')).toBeUndefined();
    });

    it('should handle undefined', () => {
      expect(mapSubType(undefined)).toBeUndefined();
    });
  });

  describe('parseArea()', () => {
    it('should parse Czech area formats', () => {
      expect(parseArea('150 m²')).toBe(150);
      expect(parseArea('150,5 m²')).toBe(150.5);
      expect(parseArea('150.5 m2')).toBe(150.5);
      expect(parseArea('150')).toBe(150);
    });

    it('should return undefined for invalid values', () => {
      expect(parseArea('N/A')).toBeUndefined();
      expect(parseArea('')).toBeUndefined();
      expect(parseArea(undefined)).toBeUndefined();
    });

    it('should return undefined for zero or negative', () => {
      expect(parseArea('0')).toBeUndefined();
      expect(parseArea('-5 m²')).toBeUndefined();
    });
  });

  describe('extractCity()', () => {
    it('should extract city from locality string', () => {
      expect(extractCity('Praha 6 - Dejvice, Podbaba')).toBe('Praha');
      expect(extractCity('Brno - Střed')).toBe('Brno');
      expect(extractCity('Ostrava')).toBe('Ostrava');
    });

    it('should handle fallback for unknown format', () => {
      expect(extractCity('Unknown')).toBe('Unknown');
    });

    it('should handle empty string', () => {
      expect(extractCity('')).toBe('Unknown');
    });
  });

  describe('isPositiveValue()', () => {
    it('should return true for Czech positive strings', () => {
      expect(isPositiveValue('Ano')).toBe(true);
      expect(isPositiveValue('ano')).toBe(true);
      expect(isPositiveValue('ANO')).toBe(true);
    });

    it('should return true for English positive strings', () => {
      expect(isPositiveValue('Yes')).toBe(true);
      expect(isPositiveValue('yes')).toBe(true);
      expect(isPositiveValue('true')).toBe(true);
      expect(isPositiveValue('connected')).toBe(true);
    });

    it('should return true for positive numbers', () => {
      expect(isPositiveValue(1)).toBe(true);
      expect(isPositiveValue(3)).toBe(true);
      expect(isPositiveValue(150)).toBe(true);
      expect(isPositiveValue(0.1)).toBe(true);
    });

    it('should return true for numeric strings', () => {
      expect(isPositiveValue('3')).toBe(true);
      expect(isPositiveValue('13')).toBe(true);
      expect(isPositiveValue('150,5')).toBe(true);
      expect(isPositiveValue('150.5')).toBe(true);
    });

    it('should return false for negative indicators', () => {
      expect(isPositiveValue('Ne')).toBe(false);
      expect(isPositiveValue('no')).toBe(false);
      expect(isPositiveValue('false')).toBe(false);
      expect(isPositiveValue('')).toBe(false);
    });

    it('should return false for zero and negative numbers', () => {
      expect(isPositiveValue(0)).toBe(false);
      expect(isPositiveValue(-1)).toBe(false);
      expect(isPositiveValue('-5')).toBe(false);
    });

    it('should return false for undefined/null', () => {
      expect(isPositiveValue(undefined)).toBe(false);
      expect(isPositiveValue(null)).toBe(false);
    });
  });

  describe('ensureBoolean()', () => {
    it('should return true for true', () => {
      expect(ensureBoolean(true)).toBe(true);
    });

    it('should return false for false', () => {
      expect(ensureBoolean(false)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(ensureBoolean(undefined)).toBe(false);
    });

    it('should never return undefined', () => {
      const result = ensureBoolean(undefined);
      expect(result).not.toBeUndefined();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('extractSellerInfo()', () => {
    it('should extract seller information', () => {
      const embedded = {
        seller: {
          name: 'Reality Company s.r.o.',
          phone: '+420 123 456 789',
          email: 'info@reality.cz',
          logo_url: 'https://example.com/logo.png'
        }
      };

      const result = extractSellerInfo(embedded);

      expect(result).toEqual({
        name: 'Reality Company s.r.o.',
        phone: '+420 123 456 789',
        email: 'info@reality.cz',
        logo_url: 'https://example.com/logo.png',
        company_name: undefined
      });
    });

    it('should handle logo nested in _links', () => {
      const embedded = {
        seller: {
          name: 'Company',
          logo: {
            _links: {
              self: { href: 'https://example.com/logo.png' }
            }
          }
        }
      };

      const result = extractSellerInfo(embedded);

      expect(result?.logo_url).toBe('https://example.com/logo.png');
    });

    it('should return undefined if no seller', () => {
      expect(extractSellerInfo({})).toBeUndefined();
      expect(extractSellerInfo(undefined)).toBeUndefined();
      expect(extractSellerInfo(null)).toBeUndefined();
    });

    it('should handle partial seller data', () => {
      const embedded = {
        seller: {
          name: 'Company'
        }
      };

      const result = extractSellerInfo(embedded);

      expect(result).toEqual({
        name: 'Company',
        phone: undefined,
        email: undefined,
        logo_url: undefined,
        company_name: undefined
      });
    });
  });

  describe('extractImages()', () => {
    it('should extract images from _embedded.images', () => {
      const listing = {
        _embedded: {
          images: [
            {
              _links: {
                dynamicDown: { href: 'https://cdn.com/thumb1.jpg' },
                dynamicUp: { href: 'https://cdn.com/preview1.jpg' },
                gallery: { href: 'https://cdn.com/full1.jpg' }
              }
            },
            {
              _links: {
                dynamicDown: { href: 'https://cdn.com/thumb2.jpg' },
                dynamicUp: { href: 'https://cdn.com/preview2.jpg' },
                gallery: { href: 'https://cdn.com/full2.jpg' }
              }
            }
          ]
        }
      };

      const result = extractImages(listing);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        thumbnail: 'https://cdn.com/thumb1.jpg',
        preview: 'https://cdn.com/preview1.jpg',
        full: 'https://cdn.com/full1.jpg'
      });
    });

    it('should extract images from _links (list endpoint)', () => {
      const listing = {
        _links: {
          dynamicUp: [
            { href: 'https://cdn.com/preview1.jpg' },
            { href: 'https://cdn.com/preview2.jpg' }
          ],
          dynamicDown: [
            { href: 'https://cdn.com/thumb1.jpg' },
            { href: 'https://cdn.com/thumb2.jpg' }
          ]
        }
      };

      const result = extractImages(listing);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        thumbnail: 'https://cdn.com/thumb1.jpg',
        preview: 'https://cdn.com/preview1.jpg',
        full: 'https://cdn.com/preview1.jpg' // Uses preview as full
      });
    });

    it('should return empty array if no images', () => {
      expect(extractImages({})).toEqual([]);
      expect(extractImages({ _embedded: {} })).toEqual([]);
      expect(extractImages({ _links: {} })).toEqual([]);
    });

    it('should handle gallery fallback to preview', () => {
      const listing = {
        _embedded: {
          images: [
            {
              _links: {
                dynamicDown: { href: 'https://cdn.com/thumb.jpg' },
                dynamicUp: { href: 'https://cdn.com/preview.jpg' }
                // No gallery
              }
            }
          ]
        }
      };

      const result = extractImages(listing);

      expect(result[0].full).toBe('https://cdn.com/preview.jpg');
    });
  });

  describe('extractVirtualTourUrl()', () => {
    it('should extract from _embedded.matterport_url', () => {
      const listing = {
        _embedded: {
          matterport_url: 'https://my.matterport.com/show/?m=abc123'
        }
      };

      expect(extractVirtualTourUrl(listing)).toBe('https://my.matterport.com/show/?m=abc123');
    });

    it('should extract from top-level matterport_url', () => {
      const listing = {
        matterport_url: 'https://my.matterport.com/show/?m=xyz789'
      };

      expect(extractVirtualTourUrl(listing)).toBe('https://my.matterport.com/show/?m=xyz789');
    });

    it('should return "available" flag if has_panorama = 1 but no URL', () => {
      const listing = {
        has_panorama: 1
      };

      expect(extractVirtualTourUrl(listing)).toBe('available');
    });

    it('should return undefined if no virtual tour', () => {
      expect(extractVirtualTourUrl({})).toBeUndefined();
      expect(extractVirtualTourUrl({ has_panorama: 0 })).toBeUndefined();
    });
  });

  describe('extractVideoUrl()', () => {
    it('should extract from _embedded.video.url', () => {
      const listing = {
        _embedded: {
          video: {
            url: 'https://youtube.com/watch?v=abc123',
            thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
          }
        }
      };

      expect(extractVideoUrl(listing)).toBe('https://youtube.com/watch?v=abc123');
    });

    it('should extract from top-level video.url', () => {
      const listing = {
        video: {
          url: 'https://youtube.com/watch?v=xyz789'
        }
      };

      expect(extractVideoUrl(listing)).toBe('https://youtube.com/watch?v=xyz789');
    });

    it('should return undefined if no video', () => {
      expect(extractVideoUrl({})).toBeUndefined();
      expect(extractVideoUrl({ _embedded: {} })).toBeUndefined();
    });
  });
});
