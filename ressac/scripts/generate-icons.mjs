// Generates every app icon (PWA, Apple, Capacitor) from the original SVG in assets-src/icon.svg.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets-src/icon.svg', import.meta.url), 'utf8');
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon.svg', out), source);

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
for (const size of [180, 192, 512]) writeFileSync(new URL(`icon-${size}.png`, out), render(source, size));
// Maskable: the artwork is kept inside the 80 % safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1f6f8f"/><g transform="translate(51 51) scale(0.8)">${source.replace(/<\?xml[^>]*>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g></svg>`;
writeFileSync(new URL('maskable-512.png', out), render(maskable, 512));
console.log('icons generated in public/icons');
