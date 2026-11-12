import fr from '../i18n/fr.json';

type Dict = Record<string, string>;

const dictionaries: Record<string, Dict> = { fr: fr as Dict };
let current = 'fr';

/** Registers a new language (or extra keys) at runtime. */
export function registerLanguage(lang: string, dict: Dict): void {
  dictionaries[lang] = { ...(dictionaries[lang] ?? {}), ...dict };
}

export function setLanguage(lang: string): void {
  if (dictionaries[lang]) current = lang;
}

export function getLanguage(): string {
  return current;
}

export function availableLanguages(): string[] {
  return Object.keys(dictionaries);
}

/** Translates a UI key. Unknown keys are returned as-is so that missing texts are visible. */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = dictionaries[current]?.[key] ?? dictionaries.fr?.[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/**
 * Localises a piece of content (species name, item description…).
 * Content is written in French in `data/`; another language can override it with
 * the key `content.<id>.<field>` in its dictionary.
 */
export function loc(id: string, field: string, fallback: string): string {
  if (current === 'fr') return fallback;
  return dictionaries[current]?.[`content.${id}.${field}`] ?? fallback;
}

export function formatNumber(n: number): string {
  return Math.round(n)
    .toLocaleString('fr-FR')
    .replace(/[\u202f\u00a0]/g, ' ');
}
