/**
 * @landomo/core - Main Export
 *
 * Shared utilities and types for Landomo scraper ecosystem
 * These are OPTIONAL utilities - scrapers can use all, some, or none
 * Scrapers are free to implement their own solutions
 */

// Types
export * from './types';

// Core Service Client
export * from './core-client/api-client';
export * from './core-client/checksum-client';

// Utilities
export * from './utils/change-detection';
export * from './utils/parsers';
export * from './utils/normalization';
export * from './utils/checksum';

// Validation
export * from './utils/validation';

// Scraper Base Class & HTTP Client
export * from './scraper';

// Scrape Run Tracking
export * from './scrape-run-tracker';

// Logger
export * from './logger';

// Tracing
export * from './tracing/setup';

// Services
export * from './services/geocoding';

// Prometheus Metrics for Scrapers
export * from './metrics';
