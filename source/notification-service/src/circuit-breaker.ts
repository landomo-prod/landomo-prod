import CircuitBreaker from 'opossum';
import { logger } from './logger';

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
};

const breakers = new Map<string, CircuitBreaker>();

export function createBreaker<T>(
  fn: (...args: any[]) => Promise<T>,
  name: string,
  overrides?: Partial<CircuitBreaker.Options>
): CircuitBreaker<any[], T> {
  const breaker = new CircuitBreaker(fn, { ...DEFAULT_OPTIONS, ...overrides, name });

  breaker.on('open', () => logger.warn({ breaker: name }, 'circuit opened'));
  breaker.on('halfOpen', () => logger.info({ breaker: name }, 'circuit half-open'));
  breaker.on('close', () => logger.info({ breaker: name }, 'circuit closed'));

  breakers.set(name, breaker);
  return breaker;
}

export function getBreaker(name: string): CircuitBreaker | undefined {
  return breakers.get(name);
}

export function getAllBreakers(): Map<string, CircuitBreaker> {
  return breakers;
}
