"use strict";
/**
 * Standardized Czech Real Estate Value Mappings
 *
 * This file defines the CANONICAL values that the Czech database expects.
 * All scrapers MUST map their portal-specific values to these standards.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTRUCTION_TYPES = exports.HEATING_TYPES = exports.ENERGY_RATINGS = exports.FURNISHED_STATUSES = exports.PROPERTY_CONDITIONS = exports.CZECH_OWNERSHIP_TYPES = exports.CZECH_DISPOSITIONS = void 0;
exports.normalizeDisposition = normalizeDisposition;
exports.normalizeOwnership = normalizeOwnership;
exports.normalizeCondition = normalizeCondition;
exports.normalizeFurnished = normalizeFurnished;
exports.normalizeEnergyRating = normalizeEnergyRating;
exports.normalizeHeatingType = normalizeHeatingType;
exports.normalizeConstructionType = normalizeConstructionType;
exports.isValidDisposition = isValidDisposition;
exports.isValidOwnership = isValidOwnership;
exports.isValidCondition = isValidCondition;
exports.isValidFurnished = isValidFurnished;
exports.isValidEnergyRating = isValidEnergyRating;
exports.isValidHeatingType = isValidHeatingType;
exports.isValidConstructionType = isValidConstructionType;
exports.parseCzechFeatures = parseCzechFeatures;
// ============================================================================
// CZECH DISPOSITION (Room Layout) - CANONICAL VALUES
// ============================================================================
exports.CZECH_DISPOSITIONS = [
    '1+kk', // 1 room + kitchenette
    '1+1', // 1 room + separate kitchen
    '2+kk', // 2 rooms + kitchenette
    '2+1', // 2 rooms + separate kitchen
    '3+kk', // 3 rooms + kitchenette
    '3+1', // 3 rooms + separate kitchen
    '4+kk', // 4 rooms + kitchenette
    '4+1', // 4 rooms + separate kitchen
    '5+kk', // 5 rooms + kitchenette
    '5+1', // 5 rooms + separate kitchen
    '6+kk', // 6 rooms + kitchenette
    '6+1', // 6 rooms + separate kitchen
    '7+kk', // 7+ rooms + kitchenette
    '7+1', // 7+ rooms + separate kitchen
    'atypical' // Non-standard layout
];
// ============================================================================
// CZECH OWNERSHIP TYPE - CANONICAL VALUES
// ============================================================================
exports.CZECH_OWNERSHIP_TYPES = [
    'personal', // Osobní vlastnictví (Personal ownership)
    'cooperative', // Družstevní vlastnictví (Cooperative ownership)
    'state', // Státní/obecní (State/municipal)
    'other' // Jiné (Other)
];
// ============================================================================
// PROPERTY CONDITION - CANONICAL VALUES
// ============================================================================
exports.PROPERTY_CONDITIONS = [
    'new', // Novostavba/nový
    'excellent', // Výborný stav
    'very_good', // Velmi dobrý stav
    'good', // Dobrý stav
    'after_renovation', // Po rekonstrukci
    'before_renovation', // Před rekonstrukcí
    'requires_renovation', // Nutná rekonstrukce
    'project', // Projekt
    'under_construction' // Výstavba
];
// ============================================================================
// MAPPER: Normalize Disposition String
// ============================================================================
function normalizeDisposition(input) {
    if (!input)
        return undefined;
    const clean = input.toLowerCase().trim().replace(/\s+/g, '');
    // Skip portal placeholder values
    if (clean === 'undefined' || clean === 'null')
        return undefined;
    // Direct matches
    const directMatch = exports.CZECH_DISPOSITIONS.find(d => clean === d.toLowerCase().replace('+', ''));
    if (directMatch)
        return directMatch;
    // Realingo format: FLAT2_KK, FLAT31, FLAT1_KK, etc.
    const flatMatch = clean.match(/flat(\d)[_]?(kk|1)/);
    if (flatMatch) {
        const roomNum = parseInt(flatMatch[1]);
        if (roomNum >= 1 && roomNum <= 7)
            return `${flatMatch[1]}+${flatMatch[2].toLowerCase()}`;
    }
    // Bezrealitky format: DISP_2_KK, DISP_3_1, etc.
    const dispMatch = clean.match(/disp[_]?(\d)[_]?(kk|1)/i);
    if (dispMatch) {
        const roomNum = parseInt(dispMatch[1]);
        if (roomNum >= 1 && roomNum <= 7)
            return `${dispMatch[1]}+${dispMatch[2].toLowerCase()}`;
    }
    // Ulovdomov camelCase: onepluskk, twoplusone, etc.
    const CAMEL_NUMBERS = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7',
    };
    const camelMatch = clean.match(/^(one|two|three|four|five|six|seven)plus(kk|one)$/);
    if (camelMatch) {
        const num = CAMEL_NUMBERS[camelMatch[1]];
        const type = camelMatch[2] === 'one' ? '1' : 'kk';
        if (num)
            return `${num}+${type}`;
    }
    // Pattern matching - ONLY allow rooms 1-7
    const match = clean.match(/(\d)\s*\+\s*(kk|1)/i);
    if (match) {
        const rooms = match[1];
        const roomNum = parseInt(rooms);
        if (roomNum >= 1 && roomNum <= 7) {
            const type = match[2].toLowerCase();
            return `${rooms}+${type}`;
        }
    }
    // Special values
    if (clean === 'garsoniera' || clean === 'garsoniéra' || clean === 'garsonka')
        return '1+kk';
    if (clean === 'sixandmore')
        return 'atypical';
    if (clean === 'ostatni')
        return 'atypical';
    if (clean.includes('atypick') || clean.includes('nestandardn') || clean === 'atypical') {
        return 'atypical';
    }
    return undefined;
}
// ============================================================================
// MAPPER: Normalize Ownership Type
// ============================================================================
// Exact-match lookup table — official Sreality číselník `ownership` values
const OWNERSHIP_MAP = {
    'Osobní': 'personal',
    'Družstevní': 'cooperative',
    'Státní/obecní': 'state',
    // Sreality numeric codes (ownership: 1=Osobní, 2=Družstevní, 3=Státní)
    '1': 'personal',
    '2': 'cooperative',
    '3': 'state',
};
function normalizeOwnership(input) {
    if (!input)
        return undefined;
    // Exact match first (Sreality API returns these exact strings)
    const exact = OWNERSHIP_MAP[input.trim()];
    if (exact)
        return exact;
    // Substring fallback for other portals
    const clean = input.toLowerCase().trim();
    if (clean.includes('osobn') || clean.includes('soukrom') || clean.includes('personal') || clean.includes('private'))
        return 'personal';
    if (clean.includes('družstev') || clean.includes('druzstev') || clean.includes('cooperative'))
        return 'cooperative';
    if (clean.includes('státn') || clean.includes('obecn') || clean.includes('statn') || clean.includes('state'))
        return 'state';
    return 'other';
}
// ============================================================================
// MAPPER: Normalize Property Condition
// ============================================================================
// Exact-match lookup table — official Sreality číselník `building_condition` values
const CONDITION_MAP = {
    'Velmi dobrý': 'very_good',
    'Dobrý': 'good',
    'Špatný': 'requires_renovation',
    'Ve výstavbě': 'under_construction',
    'Projekt': 'project',
    'Novostavba': 'new',
    'K demolici': 'requires_renovation',
    'Před rekonstrukcí': 'before_renovation',
    'Po rekonstrukci': 'after_renovation',
    'V rekonstrukci': 'under_construction',
    // Sreality numeric codes (building_condition číselník)
    '1': 'very_good',
    '2': 'good',
    '4': 'requires_renovation',
    '5': 'under_construction',
    '6': 'project',
    '8': 'new',
    '9': 'before_renovation',
    '10': 'after_renovation',
    // Bezrealitky UPPER_CASE English enum values
    'VERY_GOOD': 'very_good',
    'NEW': 'new',
    'GOOD': 'good',
    'AFTER_RECONSTRUCTION': 'after_renovation',
    'BEFORE_RECONSTRUCTION': 'before_renovation',
    'BAD': 'requires_renovation',
    'AFTER_PARTIAL_RECONSTRUCTION': 'after_renovation',
    'CONSTRUCTION': 'under_construction',
    'IN_RECONSTRUCTION': 'under_construction',
    'DEMOLITION': 'requires_renovation',
};
function normalizeCondition(input) {
    if (!input)
        return undefined;
    // Exact match first (Sreality API returns these exact strings)
    const exact = CONDITION_MAP[input.trim()];
    if (exact)
        return exact;
    const clean = input.toLowerCase().trim();
    // Map Czech terms to canonical values
    // NOTE: Order matters! Check specific patterns BEFORE generic ones to avoid false matches
    // For example: "renovation" contains "nov" so we must check "after renovation", "before renovation" etc. FIRST
    // Check specific English phrases first (before Czech patterns with partial matches)
    if (clean === 'new')
        return 'new';
    if (clean.includes('after renovation'))
        return 'after_renovation';
    if (clean.includes('before renovation'))
        return 'before_renovation';
    if (clean.includes('requires renovation'))
        return 'requires_renovation';
    if (clean.includes('under construction'))
        return 'under_construction';
    // Then check Czech-specific patterns
    if (clean.includes('novostavb') || clean.includes('nový'))
        return 'new';
    if (clean.includes('výborn') || clean.includes('excellent'))
        return 'excellent';
    if (clean.includes('velmi dobr') || clean.includes('very good'))
        return 'very_good';
    if (clean.includes('dobr') || clean.includes('good'))
        return 'good';
    if (clean.includes('po rekonstrukc'))
        return 'after_renovation';
    if (clean.includes('před rekonstrukc'))
        return 'before_renovation';
    if (clean.includes('nutná rekonstrukc') || clean === 'bad' || clean.includes('špatn') || clean.includes('k demolici'))
        return 'requires_renovation';
    if (clean.includes('bezvad') || clean.includes('flawless'))
        return 'excellent';
    if (clean.includes('projekt') || clean.includes('project'))
        return 'project';
    if (clean.includes('výstavb') || clean.includes('rozestav') || clean.includes('v rekonstrukc'))
        return 'under_construction';
    return undefined;
}
// ============================================================================
// FURNISHED STATUS - CANONICAL VALUES (3 values)
// ============================================================================
exports.FURNISHED_STATUSES = [
    'furnished', // Vybaveno/kompletně vybaveno (fully furnished)
    'partially_furnished', // Částečně vybaveno (partially furnished)
    'not_furnished' // Nevybaveno (not furnished)
];
// ============================================================================
// ENERGY RATING - CANONICAL VALUES (7 values - PENB Czech Standard)
// ============================================================================
exports.ENERGY_RATINGS = [
    'A', // Most efficient (Třída A)
    'B', // Třída B
    'C', // Třída C
    'D', // Třída D
    'E', // Třída E
    'F', // Třída F
    'G' // Least efficient (Třída G)
];
// ============================================================================
// HEATING TYPE - CANONICAL VALUES (7 values - Common Czech heating types)
// ============================================================================
exports.HEATING_TYPES = [
    'central_heating', // Ústřední topení (central heating in building)
    'individual_heating', // Individuální topení (separate per apartment)
    'electric_heating', // Elektrikum/elektrické topení (electric)
    'gas_heating', // Plynové topení (gas)
    'water_heating', // Teplá voda (hot water/radiators)
    'heat_pump', // Tepelné čerpadlo (heat pump)
    'other' // Jiné (other)
];
// ============================================================================
// MAPPER: Normalize Furnished Status
// Portal variations: YES/NO/PARTIAL (UlovDomov), EQUIPPED (BezRealitky)
// Sreality číselník `furnished` values: 'Ano' | 'Ne' | 'Částečně'
// ============================================================================
// Exact-match lookup table — official Sreality číselník `furnished` values
const FURNISHED_MAP = {
    'Ano': 'furnished',
    'Ne': 'not_furnished',
    'Částečně': 'partially_furnished',
    // Sreality numeric codes (furnished: 1=Ano, 2=Ne, 3=Částečně, 0=unknown)
    '1': 'furnished',
    '2': 'not_furnished',
    '3': 'partially_furnished',
};
function normalizeFurnished(input) {
    if (input === undefined || input === null)
        return undefined;
    // Handle boolean values
    if (typeof input === 'boolean') {
        return input ? 'furnished' : 'not_furnished';
    }
    // Exact match first (Sreality API returns 'Ano', 'Ne', 'Částečně')
    const exact = FURNISHED_MAP[String(input).trim()];
    if (exact)
        return exact;
    const clean = String(input).toLowerCase().trim();
    // Fully furnished variants
    if (clean === 'yes' ||
        clean === 'ano' ||
        clean === 'equipped' ||
        clean === 'vybaveny' ||
        clean === 'vybaveno' ||
        clean === 'zařízený' ||
        clean === 'zarizeny' ||
        clean === 'kompletně vybaveno' ||
        clean === 'kompletne vybaveno' ||
        clean === 'fully furnished' ||
        clean === 'complete') {
        return 'furnished';
    }
    // Partially furnished variants
    if (clean === 'partial' ||
        clean === 'částečně' ||
        clean === 'castecne' ||
        clean === 'částečně vybaveno' ||
        clean === 'castecne vybaveno' ||
        clean === 'partly furnished' ||
        clean === 'semi-furnished' ||
        clean === 'částečně zařízený' ||
        clean === 'castecne zarizeny') {
        return 'partially_furnished';
    }
    // Not furnished variants
    if (clean === 'no' ||
        clean === 'ne' ||
        clean === 'nevybaveno' ||
        clean === 'nevybaveny' ||
        clean === 'nezařízený' ||
        clean === 'nezarizeny' ||
        clean === 'unfurnished' ||
        clean === 'bez vybavení' ||
        clean === 'bez vybavenů') {
        return 'not_furnished';
    }
    return undefined;
}
// ============================================================================
// MAPPER: Normalize Energy Rating (PENB Standard)
// Handles: A, B, C, D, E, F, G with optional numbers/variants
// ============================================================================
// Exact-match lookup table — official Sreality PENB full label strings
const ENERGY_MAP = {
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G',
    'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E', 'f': 'F', 'g': 'G',
    'A - Mimořádně úsporná': 'A',
    'B - Velmi úsporná': 'B',
    'C - Úsporná': 'C',
    'D - Méně úsporná': 'D',
    'E - Nehospodárná': 'E',
    'F - Velmi nehospodárná': 'F',
    'G - Mimořádně nehospodárná': 'G',
    // Sreality numeric codes (energy_efficiency_rating_cb: 0=unknown, 1=A..7=G)
    '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F', '7': 'G',
};
function normalizeEnergyRating(input) {
    if (!input)
        return undefined;
    // Exact match first (handles single-letter codes and full Sreality PENB strings)
    const exact = ENERGY_MAP[input.trim()];
    if (exact)
        return exact;
    // Substring fallback: extract first letter and uppercase (handles "Třída A", "Class B", "C_EFFICIENT", etc.)
    const clean = String(input)
        .trim()
        .replace(/[\s\-]/g, '')
        .replace(/třída/i, '')
        .replace(/class/i, '')
        .substring(0, 1)
        .toUpperCase();
    if (exports.ENERGY_RATINGS.includes(clean)) {
        return clean;
    }
    return undefined;
}
// ============================================================================
// MAPPER: Normalize Heating Type
// Portal variations: Czech terms from various portals
// ============================================================================
// Exact-match lookup table — official Sreality číselník `heating` values
// Maps Sreality's exact Czech strings → canonical HeatingType values
const HEATING_MAP = {
    // Primary heating type values (field: Topení / Vytápění)
    'Lokální plynové': 'gas_heating',
    'Lokální tuhá paliva': 'other',
    'Lokální elektrické': 'electric_heating',
    'Ústřední plynové': 'gas_heating',
    'Ústřední tuhá paliva': 'other',
    'Ústřední elektrické': 'electric_heating',
    'Ústřední dálkové': 'central_heating',
    'Jiné': 'other',
    'Podlahové': 'water_heating',
    // heating_element values (may also appear as the heating field)
    'WAW': 'gas_heating',
    'Přímotop': 'electric_heating',
    'Tepelné čerpadlo': 'heat_pump',
    'Klimatizace': 'heat_pump',
    'Centrální dálkové': 'central_heating',
    'Pára s výměníkem': 'central_heating',
};
function normalizeHeatingType(input) {
    if (!input)
        return undefined;
    // Exact match first (Sreality API returns these exact strings)
    const exact = HEATING_MAP[input.trim()];
    if (exact)
        return exact;
    const clean = String(input).toLowerCase().trim();
    if (!clean)
        return undefined;
    // Central heating variants (substring fallback for other portals)
    if (clean.includes('ústřední') ||
        clean.includes('ustredni') ||
        clean.includes('central') ||
        clean.includes('ústředn')) {
        return 'central_heating';
    }
    // Individual heating variants
    if (clean.includes('individuál') ||
        clean.includes('individual') ||
        clean.includes('bytová') ||
        clean.includes('bytu')) {
        return 'individual_heating';
    }
    // Electric heating variants
    if (clean.includes('elektr') ||
        clean.includes('electric') ||
        clean.includes('prouď') ||
        clean.includes('proud')) {
        return 'electric_heating';
    }
    // Gas heating variants
    if (clean.includes('plyn') ||
        clean.includes('gas')) {
        return 'gas_heating';
    }
    // Hot water/radiator variants
    if (clean.includes('teplá voda') ||
        clean.includes('tepla voda') ||
        clean.includes('radiátor') ||
        clean.includes('radiatr') ||
        clean.includes('hot water') ||
        clean.includes('teplá')) {
        return 'water_heating';
    }
    // Heat pump variants
    if (clean.includes('tepelné čerpadlo') ||
        clean.includes('tepelne cerpald') ||
        clean.includes('heat pump') ||
        clean.includes('čerpadlo')) {
        return 'heat_pump';
    }
    return 'other';
}
// ============================================================================
// CONSTRUCTION TYPE - CANONICAL VALUES (7 values)
// ============================================================================
exports.CONSTRUCTION_TYPES = [
    'panel', // Panelový dům (panel building)
    'brick', // Cihlový (brick)
    'stone', // Zděný (stone)
    'wood', // Dřevěný (wooden)
    'concrete', // Betonový (concrete)
    'mixed', // Smíšená stavba (mixed materials)
    'other' // Jiné (other)
];
// ============================================================================
// MAPPER: Normalize Construction Type
// Portal variations: Czech terms from various portals
// ============================================================================
// Exact-match lookup table — official Sreality číselník `building_type` values
const CONSTRUCTION_MAP = {
    'Dřevostavba': 'wood',
    'Cihlová': 'brick',
    'Kamenná': 'stone',
    'Montovaná': 'other', // prefab — no dedicated canonical value; closest is 'other'
    'Panelová': 'panel',
    'Skeletová': 'concrete', // skeleton frame (reinforced concrete)
    'Smíšená': 'mixed',
    'Modulární': 'other', // modular construction
    // Sreality numeric codes (building_type_search číselník)
    '1': 'brick',
    '2': 'panel',
    '3': 'other',
};
function normalizeConstructionType(input) {
    if (!input)
        return undefined;
    // Exact match first (Sreality API returns these exact strings)
    const exact = CONSTRUCTION_MAP[input.trim()];
    if (exact)
        return exact;
    const clean = input.toLowerCase().trim();
    if (!clean)
        return undefined;
    // Substring fallback for other portals
    if (clean.includes('panel') ||
        clean.includes('panelový') ||
        clean.includes('panelov')) {
        return 'panel';
    }
    if (clean.includes('cihl') ||
        clean.includes('brick')) {
        return 'brick';
    }
    if (clean.includes('zděn') ||
        clean.includes('stone') ||
        clean.includes('zdeni') ||
        clean.includes('kamen')) {
        return 'stone';
    }
    if (clean.includes('dřev') ||
        clean.includes('wood') ||
        clean.includes('drevo')) {
        return 'wood';
    }
    if (clean.includes('beton') ||
        clean.includes('concrete')) {
        return 'concrete';
    }
    if (clean.includes('smíš') ||
        clean.includes('mixed') ||
        clean.includes('smis')) {
        return 'mixed';
    }
    if (clean.includes('skelet') || clean.includes('skeleton'))
        return 'concrete';
    if (clean.includes('prefab') || clean.includes('montovan'))
        return 'other';
    if (clean === 'jiná' || clean === 'jina' || clean === 'jiné' || clean === 'jine')
        return 'other';
    return undefined;
}
// ============================================================================
// VALIDATION HELPERS
// ============================================================================
function isValidDisposition(value) {
    return exports.CZECH_DISPOSITIONS.includes(value);
}
function isValidOwnership(value) {
    return exports.CZECH_OWNERSHIP_TYPES.includes(value);
}
function isValidCondition(value) {
    return exports.PROPERTY_CONDITIONS.includes(value);
}
function isValidFurnished(value) {
    return exports.FURNISHED_STATUSES.includes(value);
}
function isValidEnergyRating(value) {
    return exports.ENERGY_RATINGS.includes(value);
}
function isValidHeatingType(value) {
    return exports.HEATING_TYPES.includes(value);
}
function isValidConstructionType(value) {
    return exports.CONSTRUCTION_TYPES.includes(value);
}
/**
 * Parse Czech features array into structured amenities
 * Recognizes Czech amenity terms and converts them to English boolean fields
 *
 * Examples:
 * - "Parkování" → has_parking: true
 * - "Klimatizace" → has_ac: true
 * - "Sauna" → has_sauna: true
 * - "Fitness" → has_gym: true
 */
function parseCzechFeatures(features) {
    const amenities = {};
    if (!features || features.length === 0) {
        return amenities;
    }
    // Normalize all features to lowercase for matching
    const normalized = features.map(f => f.toLowerCase().trim());
    // Parking variants
    if (normalized.some(f => f.includes('parkování') || f.includes('parkovani') ||
        f.includes('parking') || f.includes('parkoviště') ||
        f.includes('parkoviste'))) {
        amenities.has_parking = true;
    }
    // Garage variants
    if (normalized.some(f => f.includes('garáž') || f.includes('garaz') ||
        f.includes('garage') || f.includes('v garáži'))) {
        amenities.has_garage = true;
    }
    // Balcony variants
    if (normalized.some(f => f.includes('balkon') || f.includes('balcony'))) {
        amenities.has_balcony = true;
    }
    // Terrace variants
    if (normalized.some(f => f.includes('terasa') || f.includes('terrace') ||
        f.includes('terasy') || f.includes('terasu'))) {
        amenities.has_terrace = true;
    }
    // Basement/cellar variants
    if (normalized.some(f => f.includes('sklep') || f.includes('sklepem') ||
        f.includes('basement') || f.includes('cellar') ||
        f.includes('spižírna') || f.includes('spizirna'))) {
        amenities.has_basement = true;
    }
    // Elevator variants
    if (normalized.some(f => f.includes('výtah') || f.includes('vytah') ||
        f.includes('ascensor') || f.includes('elevator') ||
        f.includes('lift'))) {
        amenities.has_elevator = true;
    }
    // Loggia (covered balcony) variants
    if (normalized.some(f => f.includes('logie') || f.includes('logia') ||
        f.includes('loggia') || f.includes('lodžie') ||
        f.includes('lozdie'))) {
        amenities.has_loggia = true;
    }
    // Barrier-free/wheelchair accessible variants
    if (normalized.some(f => f.includes('bezbariér') || f.includes('bezbarier') ||
        f.includes('wheelchair') || f.includes('invalid') ||
        f.includes('accessible') || f.includes('přístupn'))) {
        amenities.is_barrier_free = true;
    }
    // Pet-friendly variants
    if (normalized.some(f => f.includes('zvířat') || f.includes('zvireata') ||
        f.includes('pet') || f.includes('domácích zvířat') ||
        f.includes('domacich zvireata'))) {
        amenities.is_pet_friendly = true;
    }
    // Garden variants
    if (normalized.some(f => f.includes('zahrada') || f.includes('zahradě') ||
        f.includes('zahrade') || f.includes('garden') ||
        f.includes('venkovní prostor') || f.includes('venkovni prostor'))) {
        amenities.has_garden = true;
    }
    // Low-energy/energy-efficient variants
    if (normalized.some(f => f.includes('nízkoenerget') || f.includes('nizkoenerg') ||
        f.includes('low energy') || f.includes('energy efficient') ||
        f.includes('energeticky úsporný') || f.includes('energeticky usporn'))) {
        amenities.is_low_energy = true;
    }
    // Sauna variants
    if (normalized.some(f => f.includes('sauna'))) {
        amenities.has_sauna = true;
    }
    // Gym/Fitness variants
    if (normalized.some(f => f.includes('fitness') || f.includes('posilovna') ||
        f.includes('posilovny') || f.includes('gym') ||
        f.includes('sportoviště') || f.includes('sportoviste'))) {
        amenities.has_gym = true;
    }
    // Air conditioning variants
    if (normalized.some(f => f.includes('klimatizace') || f.includes('klimatizaci') ||
        f.includes('klimatizaci') || f.includes('air condition') ||
        f.includes('klimatizační') || f.includes('klimatizacni'))) {
        amenities.has_ac = true;
    }
    // WiFi variants
    if (normalized.some(f => f.includes('wifi') || f.includes('wi-fi') ||
        f.includes('internet'))) {
        amenities.has_wifi = true;
    }
    // Security/alarm variants
    if (normalized.some(f => f.includes('bezpeč') || f.includes('bezpec') ||
        f.includes('alarm') || f.includes('security') ||
        f.includes('kamera') || f.includes('videozáznam') ||
        f.includes('videozaznam') || f.includes('ostraha'))) {
        amenities.has_security = true;
    }
    // Storage variants
    if (normalized.some(f => f.includes('úložn') || f.includes('ulozn') ||
        f.includes('storage') || f.includes('komora') ||
        f.includes('boxu') || f.includes('sklád'))) {
        amenities.has_storage = true;
    }
    // Hot water variants
    if (normalized.some(f => f.includes('teplá voda') || f.includes('tepla voda') ||
        f.includes('hot water') || f.includes('ohřev vody') ||
        f.includes('ohrev vody'))) {
        amenities.has_hot_water = true;
    }
    // Renovated variants
    if (normalized.some(f => f.includes('rekonstruk') || f.includes('zrekonstruo') ||
        f.includes('renovovan') || f.includes('renovat') ||
        f.includes('po opravě') || f.includes('po oprave'))) {
        amenities.is_renovated = true;
    }
    return amenities;
}
