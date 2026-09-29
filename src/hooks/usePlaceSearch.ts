import { useEffect, useState } from 'react';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';
import type { PlaceRef } from '../types/course';

const DEBOUNCE_MS = 300;

type SearchState = { status: 'idle' | 'loading' | 'done'; results: PlaceRef[] };

/** Debounced search; a newer query aborts the previous request. */
export function usePlaceSearch(
  service: PlaceSearchService | null,
  query: string,
  near: () => [number, number] | undefined,
): SearchState {
  const [state, setState] = useState<SearchState>({ status: 'idle', results: [] });

  useEffect(() => {
    const trimmed = query.trim();
    if (!service || trimmed.length < 1) {
      setState({ status: 'idle', results: [] });
      return;
    }
    setState((prev) => ({ status: 'loading', results: prev.results }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const results = await service.search(trimmed, { near: near(), signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'done', results });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `near` is read at request time on purpose; it shouldn't retrigger a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, query]);

  return state;
}
