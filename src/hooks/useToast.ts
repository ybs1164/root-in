import { useCallback, useEffect, useState } from 'react';

export type Toast = { text: string; undo?: () => void };

/** The one line of news at the bottom of the screen: it leaves on its own, a little later when it offers 되돌리기. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, undo?: () => void) => setToast({ text, undo }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.undo ? 4000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);
  return { toast, notify, dismissToast };
}
