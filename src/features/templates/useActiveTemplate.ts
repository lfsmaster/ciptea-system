import { useEffect, useState } from 'react';
import { loadActiveTemplate } from './templateStore';
import type { CardTemplateDefinition } from './types';

export function useActiveTemplate() {
  const [template, setTemplate] = useState<CardTemplateDefinition>();

  useEffect(() => {
    let active = true;

    const refresh = (clearWhenMissing: boolean) => {
      void loadActiveTemplate()
        .then((value) => {
          if (!active) return;
          if (value) setTemplate(value);
          else if (clearWhenMissing) setTemplate(undefined);
        })
        .catch(() => {
          if (active && clearWhenMissing) setTemplate(undefined);
        });
    };

    refresh(false);
    const onUpdated = () => refresh(true);
    window.addEventListener('ciptea-template-updated', onUpdated);
    return () => {
      active = false;
      window.removeEventListener('ciptea-template-updated', onUpdated);
    };
  }, []);

  return { template };
}
