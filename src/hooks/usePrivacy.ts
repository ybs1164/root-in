import { useCallback, useEffect, useRef, useState } from 'react';
import { PRIVACY_LIMITS, type ExcludedPlace } from '../domain/privacy';
import { loadPrivacy, savePrivacy } from '../services/privacyRepository';

/** Where an address is, or null if it can't be found (search failed or nothing matched). */
export type ResolveAddress = (address: string) => Promise<[number, number] | null>;

/**
 * 개인 정보 → 제외 주소, kept in `goodroot:privacy:v1`. A new address is
 * saved at once, then looked up so places near it can be matched; the
 * location only lands if the address hasn't changed again meanwhile.
 */
export function usePrivacy(resolve: ResolveAddress) {
  const [excluded, setExcluded] = useState<ExcludedPlace[]>(() => loadPrivacy().excluded);
  const [resolving, setResolving] = useState<ReadonlySet<string>>(new Set());
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  useEffect(() => {
    savePrivacy({ excluded });
  }, [excluded]);

  const setAddress = useCallback((id: string, address: string) => {
    setExcluded((list) => list.map((p) => (p.id === id ? { id: p.id, kind: p.kind, address } : p)));
    if (!address) return;
    setResolving((s) => new Set(s).add(id));
    void resolveRef.current(address).then((center) => {
      setResolving((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      if (center) setExcluded((list) => list.map((p) => (p.id === id && p.address === address ? { ...p, center } : p)));
    });
  }, []);

  const add = useCallback((): string | null => {
    if (excluded.length >= PRIVACY_LIMITS.maxPlaces) return null;
    const id = `x-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setExcluded((list) => [...list, { id, kind: 'other', address: '' }]);
    return id;
  }, [excluded.length]);

  const remove = useCallback((id: string) => {
    setExcluded((list) => list.filter((p) => p.id !== id || p.kind === 'home'));
  }, []);

  return { excluded, resolving, setAddress, add, remove };
}
