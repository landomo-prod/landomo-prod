"use strict";
/**
 * Maps Realingo API enum values to standardized Landomo field values.
 * All functions return undefined when input is null/undefined/unrecognized.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBuildingType = mapBuildingType;
exports.mapCondition = mapCondition;
exports.mapEnergyClass = mapEnergyClass;
exports.mapFurnished = mapFurnished;
exports.mapHeating = mapHeating;
exports.mapOwnership = mapOwnership;
exports.extractAgent = extractAgent;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBuildingType(val) {
    if (!val)
        return undefined;
    const map = {
        BRICK: 'brick',
        PANEL: 'panel',
        WOOD: 'wood',
        PREFAB: 'prefab',
        STONE: 'stone',
        MIXED: 'mixed',
        OTHER: 'other',
    };
    return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCondition(val) {
    if (!val)
        return undefined;
    const map = {
        NEW: 'new',
        VERY_GOOD: 'excellent',
        GOOD: 'good',
        POOR: 'requires_renovation',
        AFTER_RECONSTRUCTION: 'after_renovation',
    };
    return map[val] ?? undefined;
}
function mapEnergyClass(val) {
    if (!val)
        return undefined;
    // Extract first character and uppercase — handles both single letters (A, B)
    // and verbose enum values (A_EXTREMELY_EFFICIENT, C_EFFICIENT, D_LESS_EFFICIENT, etc.)
    const letter = val.trim().substring(0, 1).toUpperCase();
    if (/^[A-G]$/.test(letter))
        return letter;
    return undefined;
}
function mapFurnished(val) {
    if (!val)
        return undefined;
    if (val === 'FURNISHED')
        return 'furnished';
    if (val === 'PARTIALLY_FURNISHED')
        return 'partially_furnished';
    if (val === 'UNFURNISHED')
        return 'not_furnished';
    return undefined;
}
function mapHeating(val) {
    if (!val)
        return undefined;
    const map = {
        GAS: 'gas',
        ELECTRIC: 'electric',
        HEAT_PUMP: 'heat_pump',
        DISTRICT: 'district',
        SOLID: 'solid_fuel',
        SOLAR: 'solar',
        BIOMASS: 'biomass',
        GEOTHERMAL: 'geothermal',
        OTHER: 'other',
    };
    return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}
function mapOwnership(val) {
    if (!val)
        return undefined;
    const map = {
        PRIVATE: 'private',
        COOPERATIVE: 'cooperative',
        STATE: 'state',
        OTHER: 'other',
    };
    return map[val] ?? (typeof val === 'string' ? val.toLowerCase() : undefined);
}
function extractAgent(detail) {
    const contact = detail?.contact;
    if (!contact)
        return undefined;
    const name = contact.person?.name || contact.company?.name;
    if (!name)
        return undefined;
    return {
        name,
        phone: contact.person?.phone || contact.company?.phone || undefined,
        agency: contact.company?.name,
    };
}
