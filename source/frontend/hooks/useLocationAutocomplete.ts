import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationSuggestion } from '@/lib/api/types';
import { getLocationSuggestions } from '@/lib/api/client';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function useLocationAutocomplete(query: string, country: string = 'czech') {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      clearPending();
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    clearPending();
    setIsLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const results = await getLocationSuggestions(query, country);
        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return clearPending;
  }, [query, country, clearPending]);

  return { suggestions, isLoading };
}
