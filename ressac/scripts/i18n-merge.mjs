// Dev helper: merges a JSON object given on stdin into src/i18n/fr.json (sorted keys).
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../src/i18n/fr.json', import.meta.url);
const current = JSON.parse(readFileSync(path, 'utf8'));
const extra = JSON.parse(readFileSync(0, 'utf8'));
const merged = { ...current, ...extra };
const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} keys`);
