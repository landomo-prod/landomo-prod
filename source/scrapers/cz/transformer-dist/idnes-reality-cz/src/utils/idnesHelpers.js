"use strict";
/**
 * Shared helper functions for Idnes Reality transformers.
 * Extracted from individual transformers to eliminate duplication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTransactionType = mapTransactionType;
exports.extractCityFromLocation = extractCityFromLocation;
exports.extractAvailableFromAttrs = extractAvailableFromAttrs;
exports.parseYearBuiltFromAttrs = parseYearBuiltFromAttrs;
exports.extractRenovationYearFromAttrs = extractRenovationYearFromAttrs;
exports.parseMoneyFromAttrs = parseMoneyFromAttrs;
exports.extractDepositFromAttrs = extractDepositFromAttrs;
exports.extractCommissionFromAttrs = extractCommissionFromAttrs;
exports.parseBathroomsFromAttrs = parseBathroomsFromAttrs;
exports.extractBedroomsFromDisposition = extractBedroomsFromDisposition;
exports.parseRooms = parseRooms;
exports.parseFloorFromAttrs = parseFloorFromAttrs;
exports.parseTotalFloorsFromAttrs = parseTotalFloorsFromAttrs;
exports.parseAreaFromAttrs = parseAreaFromAttrs;
exports.extractAreaFromAttrs = extractAreaFromAttrs;
exports.parseBooleanFromAttr = parseBooleanFromAttr;
exports.parseAmenitiesFromAttrs = parseAmenitiesFromAttrs;
exports.parseParkingSpacesFromAttrs = parseParkingSpacesFromAttrs;
exports.checkGarageFromParking = checkGarageFromParking;
exports.extractDispositionFromTitle = extractDispositionFromTitle;
exports.extractFloorLocation = extractFloorLocation;
// ============ Transaction Type ============
function mapTransactionType(type) {
    if (!type)
        return 'sale';
    const lower = type.toLowerCase();
    if (lower.includes('rent') || lower.includes('pronájem') || lower.includes('pronajem')) {
        return 'rent';
    }
    return 'sale';
}
// ============ Location Helpers ============
function extractCityFromLocation(location) {
    if (!location)
        return undefined;
    return location.city || location.district;
}
// ============ Date Extraction ============
function extractAvailableFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['k nastěhování', 'datum nastěhování', 'dostupné od', 'volné od', 'nastěhování'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const czechDateMatch = val.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (czechDateMatch) {
                const [, day, month, year] = czechDateMatch;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            try {
                const date = new Date(val);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
            catch {
                // ignore
            }
        }
    }
    return undefined;
}
// ============ Year Extraction ============
function parseYearBuiltFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['rok výstavby', 'rok kolaudace', 'rok stavby', 'rok vzniku', 'výstavba', 'kolaudace'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const match = val.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
            if (match) {
                const year = parseInt(match[0]);
                if (year >= 1800 && year <= 2100)
                    return year;
            }
        }
    }
    return undefined;
}
function extractRenovationYearFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['rok rekonstrukce', 'rekonstrukce rok', 'rok renovace', 'rekonstrukce'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const match = val.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
            if (match) {
                const year = parseInt(match[0]);
                if (year >= 1800 && year <= 2100)
                    return year;
            }
        }
    }
    return undefined;
}
// ============ Monetary Extraction ============
function parseMoneyFromAttrs(attrs, keys) {
    if (!attrs || !keys)
        return undefined;
    for (const key of keys) {
        const val = attrs[key.toLowerCase()];
        if (val) {
            const cleaned = val.replace(/[Kč€\s]/g, '').replace(/,/g, '').replace(/\./g, '');
            const match = cleaned.match(/(\d+)/);
            if (match)
                return parseInt(match[1]);
        }
    }
    return undefined;
}
function extractDepositFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['kauce', 'vratná kauce', 'jistina', 'deposit'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const cleaned = val.replace(/[Kč€\s]/g, '').replace(/,/g, '').replace(/\./g, '');
            const match = cleaned.match(/(\d+)/);
            if (match)
                return parseInt(match[1]);
        }
    }
    return undefined;
}
// ============ Commission ============
function extractCommissionFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const val = attrs['provize'];
    if (!val)
        return undefined;
    const lower = val.toLowerCase().trim();
    if (lower.includes('nájemce neplatí') || lower.includes('bez provize') || lower === 'ne' || lower === '0') {
        return { is_commission: false };
    }
    return { is_commission: true, commission_note: val };
}
// ============ Bathroom / Room Extraction ============
function parseBathroomsFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['počet koupelen', 'koupelny', 'koupelna'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const match = val.match(/(\d+)/);
            if (match)
                return parseInt(match[1]);
        }
    }
    return undefined;
}
/**
 * Extract bedroom count from Czech disposition string.
 * Czech convention: the number in disposition includes the living room.
 * For "3+1" or "3+kk", rooms=3 includes living room, so bedrooms = 3-1 = 2.
 * For "1+kk" or "1+1", bedrooms = max(1-1, 1) = 1 (studio has at least 1 sleeping area).
 */
function extractBedroomsFromDisposition(rooms) {
    if (!rooms)
        return undefined;
    const match = rooms.match(/(\d+)/);
    if (!match)
        return undefined;
    const roomCount = parseInt(match[1]);
    return Math.max(roomCount - 1, 1);
}
function parseRooms(rooms) {
    if (!rooms)
        return undefined;
    const match = rooms.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
// ============ Floor Extraction ============
function parseFloorFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const keys = ['podlaží', 'patro', 'číslo podlaží'];
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const lower = val.toLowerCase();
            if (lower.includes('přízemí') || lower.includes('parter'))
                return 0;
            if (lower.includes('suterén') || lower.includes('podzemní'))
                return -1;
            const slashMatch = val.match(/(\d+)\s*\/\s*\d+/);
            if (slashMatch)
                return parseInt(slashMatch[1]);
            const match = val.match(/(\d+)/);
            if (match)
                return parseInt(match[1]);
        }
    }
    return undefined;
}
function parseTotalFloorsFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const totalKeys = ['počet podlaží', 'celkem podlaží', 'počet pater', 'podlaží celkem', 'počet podlaží budovy'];
    for (const key of totalKeys) {
        const val = attrs[key];
        if (val) {
            const match = val.match(/(\d+)/);
            if (match)
                return parseInt(match[1]);
        }
    }
    const floorKeys = ['podlaží', 'patro'];
    for (const key of floorKeys) {
        const val = attrs[key];
        if (val) {
            const slashMatch = val.match(/\d+\s*\/\s*(\d+)/);
            if (slashMatch)
                return parseInt(slashMatch[1]);
        }
    }
    return undefined;
}
// ============ Area Extraction ============
function parseAreaFromAttrs(attrs, keys) {
    if (!attrs || !keys)
        return undefined;
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const lower = val.toLowerCase().trim();
            if (lower === 'ne' || lower === 'no' || lower === 'není' || lower === '')
                continue;
            const areaMatch = val.match(/([\d.,]+)\s*m[²2]/);
            if (areaMatch) {
                return parseFloat(areaMatch[1].replace(',', '.'));
            }
            const numMatch = val.match(/^[\s]*([\d.,]+)[\s]*$/);
            if (numMatch) {
                return parseFloat(numMatch[1].replace(',', '.'));
            }
        }
    }
    return undefined;
}
/**
 * Simpler area extraction (for house transformer) — parses integers from attrs.
 */
function extractAreaFromAttrs(attrs, keys) {
    if (!attrs || !keys)
        return undefined;
    for (const key of keys) {
        const val = attrs[key];
        if (val) {
            const match = val.match(/([\d\s]+)/);
            if (match) {
                const num = parseInt(match[1].replace(/\s/g, ''));
                if (num > 0)
                    return num;
            }
        }
    }
    return undefined;
}
// ============ Boolean Parsing ============
function parseBooleanFromAttr(val) {
    if (!val)
        return undefined;
    const lower = val.toLowerCase().trim();
    if (lower === 'ano')
        return true;
    if (lower === 'ne')
        return false;
    return undefined;
}
// ============ Amenities ============
function parseAmenitiesFromAttrs(attrs) {
    if (!attrs)
        return {};
    const result = {};
    const mappings = [
        { keys: ['výtah', 'vytah', 'elevator'], field: 'has_elevator' },
        { keys: ['balkon', 'balkón', 'balcony', 'plocha balkonu'], field: 'has_balcony' },
        { keys: ['terasa', 'terrace', 'plocha terasy'], field: 'has_terrace' },
        { keys: ['sklep', 'basement', 'plocha sklepa'], field: 'has_basement' },
        { keys: ['garáž', 'garaz', 'garage'], field: 'has_garage' },
        { keys: ['parkování', 'parkovani', 'parking', 'parkovací stání', 'parkovací místo'], field: 'has_parking' },
        { keys: ['lodžie', 'lozdie', 'loggia', 'plocha lodžie'], field: 'has_loggia' },
        { keys: ['zahrada', 'garden', 'plocha zahrady'], field: 'has_garden' },
    ];
    for (const { keys, field } of mappings) {
        for (const key of keys) {
            const val = attrs[key];
            if (val !== undefined) {
                const lower = val.toLowerCase().trim();
                if (lower === 'ne' || lower === 'není' || lower === 'no') {
                    result[field] = false;
                }
                else {
                    result[field] = true;
                }
                break;
            }
        }
    }
    return result;
}
// ============ Parking ============
function parseParkingSpacesFromAttrs(attrs) {
    if (!attrs)
        return undefined;
    const val = attrs['počet parkovacích míst'];
    if (val) {
        const match = val.match(/(\d+)/);
        if (match)
            return parseInt(match[1]);
    }
    return undefined;
}
function checkGarageFromParking(attrs) {
    if (!attrs)
        return undefined;
    const val = attrs['parkování'];
    if (val && val.toLowerCase().includes('garáž'))
        return true;
    return undefined;
}
// ============ Disposition Extraction ============
function extractDispositionFromTitle(title) {
    if (!title)
        return undefined;
    const match = title.match(/(\d+\+(?:kk|\d))/i);
    return match ? match[1] : undefined;
}
// ============ Floor Location ============
function extractFloorLocation(floorNum, totalFloors) {
    if (floorNum === undefined)
        return undefined;
    if (floorNum === 0)
        return 'ground_floor';
    if (totalFloors !== undefined && (floorNum === totalFloors || floorNum === totalFloors - 1)) {
        return 'top_floor';
    }
    return 'middle_floor';
}
