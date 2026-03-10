/**
 * Country Registry
 *
 * Central registry for all country modules. Auto-discovers and registers
 * country modules, providing a clean API for accessing country-specific logic.
 */

import { CountryModule, CountryConfig } from './base/CountryModule';
import { config } from '../config';
import { CzechModule } from './czech';
import { UKModule } from './uk';
import { AustraliaModule } from './australia';
import { USAModule } from './usa';
import { FranceModule } from './france';
import { SpainModule } from './spain';
import { ItalyModule } from './italy';
import { GermanyModule } from './germany';
import { AustriaModule } from './austria';
import { SlovakiaModule } from './slovakia';
import { HungaryModule } from './hungary';

// Registry of all country modules
const allModules: Record<string, CountryModule> = {
  czech: new CzechModule(),
  uk: new UKModule(),
  australia: new AustraliaModule(),
  usa: new USAModule(),
  france: new FranceModule(),
  spain: new SpainModule(),
  italy: new ItalyModule(),
  germany: new GermanyModule(),
  austria: new AustriaModule(),
  slovakia: new SlovakiaModule(),
  hungary: new HungaryModule()
};

// Filter to only supported countries if SUPPORTED_COUNTRIES is set
const supported = config.countries.supported;
const modules: Record<string, CountryModule> = supported.length > 0
  ? Object.fromEntries(Object.entries(allModules).filter(([code]) => supported.includes(code)))
  : allModules;

/**
 * Get module by country code
 *
 * @param countryCode - Country code (e.g., 'czech', 'uk')
 * @returns Country module instance
 * @throws Error if country not found
 */
export function getCountryModule(countryCode: string): CountryModule {
  const module = modules[countryCode.toLowerCase()];
  if (!module) {
    throw new Error(`No module found for country: ${countryCode}`);
  }
  return module;
}

/**
 * Get all available countries
 *
 * @returns Array of country configurations
 */
export function getAllCountries(): CountryConfig[] {
  return Object.values(modules).map(m => m.config);
}

/**
 * Get all country modules
 *
 * @returns Array of all country modules
 */
export function getAllModules(): CountryModule[] {
  return Object.values(modules);
}

/**
 * Get all country codes
 *
 * @returns Array of country codes
 */
export function getAllCountryCodes(): string[] {
  return Object.keys(modules);
}

/**
 * Validate if country exists
 *
 * @param countryCode - Country code to validate
 * @returns True if country exists
 */
export function isValidCountry(countryCode: string): boolean {
  return countryCode.toLowerCase() in modules;
}

/**
 * Get multiple country modules by codes
 *
 * @param countryCodes - Array of country codes or ['*'] for all
 * @returns Array of country modules
 */
export function getCountryModules(countryCodes: string[]): CountryModule[] {
  if (countryCodes.includes('*')) {
    return getAllModules();
  }

  return countryCodes
    .filter(code => isValidCountry(code))
    .map(code => getCountryModule(code));
}

/**
 * Get database names for given country codes
 *
 * @param countryCodes - Array of country codes
 * @returns Map of country code to database name
 */
export function getDatabaseNames(countryCodes: string[]): Map<string, string> {
  const dbNames = new Map<string, string>();

  const countryModules = getCountryModules(countryCodes);
  countryModules.forEach(module => {
    dbNames.set(module.config.code, module.config.database);
  });

  return dbNames;
}
