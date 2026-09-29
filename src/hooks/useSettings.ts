import { useCallback, useState } from 'react';
import { loadSettings, saveSettings, type Settings } from '../services/settingsRepository';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = useCallback((change: (s: Settings) => Settings) => {
    setSettings((prev) => {
      const next = change(prev);
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
