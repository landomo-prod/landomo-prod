"use strict";
/**
 * Type-safe constants and interfaces for SReality API
 * Based on reverse-engineered API documentation from SReality Android app v1.5.2
 *
 * Reference: /Users/samuelseidel/Development/sreality/SREALITY_API_RESPONSE_MAPPINGS.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_NAMES = void 0;
/**
 * Czech field names used in items array
 * These are the exact field names as they appear in the SReality API responses
 */
exports.FIELD_NAMES = {
    // Area fields
    LIVING_AREA: 'Užitná plocha',
    LIVING_AREA_TRUNCATED: 'Užitná ploch', // API often truncates the trailing 'a'
    TOTAL_AREA: 'Celková plocha',
    AREA: 'Plocha',
    PLOT_AREA: 'Plocha pozemku',
    BUILT_UP_AREA: 'Zastavěná plocha',
    BUILT_UP_AREA_ALT: 'Plocha zastavěná', // API sometimes uses reversed word order
    // Outdoor spaces
    BALCONY: 'Balkón',
    BALCONY_ALT: 'Balkon',
    LOGGIA: 'Lodžie',
    TERRACE: 'Terasa',
    GARDEN: 'Zahrada',
    GARDEN_AREA: 'Plocha zahrady', // API sometimes uses this instead of 'Zahrada'
    // Storage
    CELLAR: 'Sklep',
    BASEMENT: 'Suterén',
    // Building characteristics
    BUILDING_TYPE: 'Typ budovy',
    CONSTRUCTION: 'Stavba',
    FLOOR: 'Podlaží',
    TOTAL_FLOORS: 'Počet podlaží',
    FLOOR_COUNT: 'Počet pater',
    FLOORS_IN_BUILDING: 'Pater v domě',
    // Property details
    DISPOSITION: 'Dispozice',
    CONDITION: 'Stav objektu',
    OWNERSHIP: 'Vlastnictví',
    FURNISHED: 'Vybavení',
    // Utilities
    HEATING: 'Topení',
    HEATING_ALT: 'Vytápění',
    HEATING_EN: 'Heating',
    WATER: 'Voda',
    SEWAGE: 'Odpad',
    ELECTRICITY: 'Elektřina',
    GAS: 'Plyn',
    // Energy
    ENERGY_CLASS: 'Třída PENB',
    ENERGY_RATING: 'Energetická náročnost budovy',
    // Amenities
    ELEVATOR: 'Výtah',
    PARKING: 'Parkování',
    GARAGE: 'Garáž',
    // Year built / renovation
    YEAR_BUILT: 'Rok postavení',
    YEAR_BUILT_ALT: 'Rok výstavby',
    YEAR_COMPLETED: 'Rok kolaudace', // Actual field the API returns (occupancy certificate year)
    RENOVATION_YEAR: 'Rok rekonstrukce',
    // Financial (rentals)
    DEPOSIT: 'Kauce',
    HOA_FEES: 'Poplatky za správu',
    UTILITY_CHARGES: 'Měsíční náklady na energie',
    SERVICE_CHARGES: 'Měsíční náklady',
    AVAILABLE_FROM: 'Datum nastěhování',
    AVAILABLE_FROM_ALT: 'Dostupné od',
    // Land-specific
    ZONING: 'Druh pozemku',
    LAND_TYPE: 'Typ pozemku',
    // Commercial-specific
    COMMERCIAL_TYPE: 'Typ nemovitosti',
    COMMERCIAL_SUBTYPE: 'Druh prostoru',
    // Dates
    AKTUALIZACE: 'Aktualizace',
    // Additional amenities
    KLIMATIZACE: 'Klimatizace',
    BAZEN: 'Bazén',
    KRB: 'Krb',
    PODKROVI: 'Podkroví',
    PUDA: 'Půda',
    BEZBARIEROVY: 'Bezbariérový',
    BEZBARIEROVA: 'Bezbariérová',
    VYSKA_STROPU: 'Výška stropu',
    VYSKA_MISTNOSTI: 'Výška místnosti',
    OPLOCENI: 'Oplocení',
    ALARM: 'Alarm',
    ZABEZPECOVACI_SYSTEM: 'Zabezpečovací systém',
    SOLARNI_PANELY: 'Solární panely',
    FOTOVOLTAIKA: 'Fotovoltaika',
    PRISTUP: 'Přístup',
    PRISTUPOVA_CESTA: 'Přístupová cesta',
    CESTA: 'Cesta',
    STAVEBNI_POVOLENI: 'Stavební povolení',
    TEREN: 'Terén',
    SVAZITOST: 'Svažitost',
    KVALITA_PUDY: 'Kvalita půdy',
    ZASTAVITELNOST: 'Zastavitelnost',
    MOZNOST_ZASTAVENI: 'Možnost zastavění',
    CISLO_PARCELY: 'Číslo parcely',
    PARCELNI_CISLO: 'Parcelní číslo',
    PARCELA: 'Parcela',
    DAN_Z_NEMOVITOSTI: 'Daň z nemovitosti',
    TYP_STRECHY: 'Typ střechy',
    STRECHA: 'Střecha',
    ZAVLAZOVANI: 'Zavlažování',
    ZAVLAZOVACI_SYSTEM: 'Zavlažovací systém',
};
