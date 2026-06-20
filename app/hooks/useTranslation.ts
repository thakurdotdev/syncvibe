import { useMemo } from 'react';

const translations = {
  en: {
    queue: {
      title: 'Queue',
      subtitle: '{count} songs in queue',
    },
  },
};

export const useTranslation = () => {
  const t = useMemo(
    () => (key: string, params?: Record<string, any>) => {
      const keys = key.split('.');
      let value: any = translations.en;

      for (const k of keys) {
        value = value[k];
        if (!value) return key;
      }

      if (typeof value === 'string' && params) {
        return value.replace(/\{(\w+)\}/g, (_, key) => params[key] || '');
      }

      return value;
    },
    []
  );

  return { t };
};
