import { useEffect, useState } from 'react';
import type { StoredPing } from '../domain/dayPings';
import { loadPings, onPingsChanged } from '../services/pingRepository';

/** The stored TODAY pings, re-read whenever they change (a new pin here, or a pull). */
export function useStoredPings(): StoredPing[] {
  const [pings, setPings] = useState(loadPings);
  useEffect(() => onPingsChanged(() => setPings(loadPings())), []);
  return pings;
}
