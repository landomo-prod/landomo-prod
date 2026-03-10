/**
 * Shared utility for analyzing distinct field values across a large sample of raw portal data.
 * Used by fetch-distinct-values.ts scripts.
 */

const MAX_DISTINCT_FOR_FULL_LIST = 100;
const SAMPLE_VALUES_COUNT = 10;

interface FieldStats {
  types: Record<string, number>;
  non_null_count: number;
  null_count: number;
  values: Map<string, number>;
  numeric_min?: number;
  numeric_max?: number;
  sample_values: any[];
}

interface FieldReport {
  types: Record<string, number>;
  non_null_count: number;
  null_count: number;
  distinct_count: number;
  min?: number;
  max?: number;
  all_distinct_values?: string[];
  value_counts?: Record<string, number>;
  sample_values?: any[];
}

export class FieldCollector {
  private fields = new Map<string, FieldStats>();

  add(obj: any, prefix = ""): void {
    this.walk(obj, prefix);
  }

  private walk(value: any, path: string): void {
    if (value === null || value === undefined) {
      this.record(path, null);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) { this.record(path, "[]"); return; }
      for (const item of value) { this.walk(item, path + "[]"); }
      return;
    }
    if (typeof value === "object" && !(value instanceof Date)) {
      const keys = Object.keys(value);
      if (keys.length === 0) { this.record(path, "{}"); return; }
      for (const key of keys) {
        const childPath = path ? `${path}.${key}` : key;
        this.walk(value[key], childPath);
      }
      return;
    }
    this.record(path, value);
  }

  private record(path: string, value: any): void {
    if (!path) return;
    let stats = this.fields.get(path);
    if (!stats) {
      stats = { types: {}, non_null_count: 0, null_count: 0, values: new Map(), sample_values: [] };
      this.fields.set(path, stats);
    }
    if (value === null || value === undefined) { stats.null_count++; return; }
    stats.non_null_count++;
    const type = typeof value;
    stats.types[type] = (stats.types[type] || 0) + 1;
    if (type === "number" && isFinite(value)) {
      stats.numeric_min = stats.numeric_min === undefined ? value : Math.min(stats.numeric_min, value);
      stats.numeric_max = stats.numeric_max === undefined ? value : Math.max(stats.numeric_max, value);
    }
    const strVal = String(value);
    if (stats.values.size < 10000) {
      stats.values.set(strVal, (stats.values.get(strVal) || 0) + 1);
    }
    if (stats.sample_values.length < SAMPLE_VALUES_COUNT) {
      if (!stats.sample_values.some(s => String(s) === strVal)) {
        stats.sample_values.push(value);
      }
    }
  }

  report(): Record<string, FieldReport> {
    const result: Record<string, FieldReport> = {};
    const sortedPaths = [...this.fields.keys()].sort();
    for (const path of sortedPaths) {
      const stats = this.fields.get(path)!;
      const distinctCount = stats.values.size;
      const entry: FieldReport = {
        types: stats.types, non_null_count: stats.non_null_count,
        null_count: stats.null_count, distinct_count: distinctCount,
      };
      if (stats.numeric_min !== undefined) { entry.min = stats.numeric_min; entry.max = stats.numeric_max; }
      if (distinctCount <= MAX_DISTINCT_FOR_FULL_LIST) {
        const sorted = [...stats.values.entries()].sort((a, b) => b[1] - a[1]);
        entry.all_distinct_values = sorted.map(([v]) => v);
        entry.value_counts = Object.fromEntries(sorted);
      } else {
        entry.sample_values = stats.sample_values;
      }
      result[path] = entry;
    }
    return result;
  }
}

export function parsePages(defaultPages: number): number {
  const idx = process.argv.indexOf("--pages");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return defaultPages;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
