import { SPECIES } from '../data/species';
import { fishSvg } from './fish';

/** Illustrated panels of the introduction, drawn in SVG (300 × 200). */
const frame = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" class="illustration" role="img" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;

const waves = (y: number, color: string, opacity = 1): string =>
  `<path d="M0 ${y}q18.750-9 37.500 0t37.500 0 37.500 0 37.500 0 37.500 0 37.500 0 37.500 0 37.500 0V200H0z" fill="${color}" opacity="${opacity}"/>`;

function letter(): string {
  return frame(
    '<rect width="300" height="200" fill="#c79a66"/>' +
      '<path d="M0 40h300M0 90h300M0 145h300" stroke="#b08452" stroke-width="3"/>' +
      '<path d="M60 0v40M190 40v50M110 90v55M240 145v55" stroke="#b08452" stroke-width="2"/>' +
      '<g transform="rotate(-6 150 100)">' +
      '<rect x="62" y="48" width="176" height="112" rx="6" fill="#fbf5e6" stroke="#1d3344" stroke-width="3"/>' +
      '<path d="M62 54l88 60 88-60" fill="none" stroke="#1d3344" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M62 158l62-52M238 158l-62-52" stroke="#d9cdb0" stroke-width="2"/>' +
      '<circle cx="150" cy="118" r="15" fill="#e2543e" stroke="#a8342a" stroke-width="3"/>' +
      '<path d="M141 119c3-4 6-4 9 0s6 4 9 0" stroke="#fbf5e6" stroke-width="2.500" fill="none" stroke-linecap="round"/>' +
      '<rect x="200" y="58" width="26" height="30" fill="#3f8fb5" stroke="#fbf5e6" stroke-width="3"/><path d="M203 80q10-14 20 0" fill="#fbf5e6"/>' +
      '</g>' +
      '<g transform="rotate(14 60 160)"><rect x="30" y="150" width="70" height="10" rx="5" fill="#1d3344"/><path d="M100 150l12 5-12 5z" fill="#e8a82e"/></g>',
  );
}

function boat(): string {
  return frame(
    '<defs><linearGradient id="il-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0e8"/><stop offset="1" stop-color="#fdebc0"/></linearGradient></defs>' +
      '<rect width="300" height="200" fill="url(#il-sky)"/>' +
      '<circle cx="232" cy="46" r="20" fill="#fff3c4"/>' +
      '<g fill="#ffffff" opacity="0.9"><ellipse cx="70" cy="40" rx="30" ry="10"/><ellipse cx="92" cy="33" rx="20" ry="9"/><ellipse cx="180" cy="26" rx="22" ry="7"/></g>' +
      // Island and cabin.
      '<path d="M150 118c20-34 60-52 104-46 20 3 36 14 46 28v20H150z" fill="#8fae7a"/>' +
      '<path d="M190 118c16-20 46-28 80-24l30 10v14z" fill="#6f9a66"/>' +
      '<rect x="222" y="64" width="34" height="24" fill="#f6ecd2" stroke="#1d3344" stroke-width="2"/><path d="M216 66l23-18 23 18z" fill="#e2543e" stroke="#1d3344" stroke-width="2" stroke-linejoin="round"/><rect x="234" y="74" width="9" height="14" fill="#7a4a2c"/><rect x="247" y="71" width="6" height="6" fill="#8fd0e8" stroke="#1d3344" stroke-width="1"/>' +
      '<rect x="20" y="56" width="10" height="62" fill="#f6ecd2" stroke="#1d3344" stroke-width="2"/><path d="M18 56h14l-3-10h-8z" fill="#e2543e" stroke="#1d3344" stroke-width="2"/><path d="M20 76h10M20 96h10" stroke="#e2543e" stroke-width="5"/>' +
      waves(118, '#4fb0c6') +
      // Quay.
      '<path d="M150 124h150v14H150z" fill="#b08452" stroke="#1d3344" stroke-width="2"/><path d="M170 138v40M210 138v40M250 138v40M290 138v40" stroke="#7a5a3a" stroke-width="6"/>' +
      waves(138, '#3a9ab5', 0.9) +
      // The red boat.
      '<g transform="rotate(-4 100 150)"><path d="M52 140h100l-12 24H66z" fill="#c94a3a" stroke="#1d3344" stroke-width="3" stroke-linejoin="round"/><path d="M56 147h92" stroke="#f0e0c0" stroke-width="4"/><path d="M100 140V100" stroke="#7a4a2c" stroke-width="4"/><path d="M103 104l26 30h-26z" fill="#fbf5e6" stroke="#1d3344" stroke-width="2" stroke-linejoin="round"/></g>' +
      waves(162, '#2a7f9c') +
      waves(182, '#1f6f8f'),
  );
}

function journal(): string {
  const a = SPECIES.find((s) => s.id === 'vieille')!;
  const b = SPECIES.find((s) => s.id === 'bar')!;
  const c = SPECIES.find((s) => s.id === 'congre')!;
  const place = (svg: string, x: number, y: number, w: number): string =>
    `<g transform="translate(${x} ${y}) scale(${w / 240})">${svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>`;
  return frame(
    '<rect width="300" height="200" fill="#5a3f2a"/><circle cx="262" cy="34" r="46" fill="#f3d27a" opacity="0.25"/>' +
      '<g transform="rotate(-3 150 105)">' +
      '<rect x="30" y="36" width="240" height="140" rx="8" fill="#7a4a2c"/>' +
      '<rect x="38" y="30" width="112" height="140" rx="4" fill="#f6ecd2" stroke="#1d3344" stroke-width="2"/>' +
      '<rect x="150" y="30" width="112" height="140" rx="4" fill="#fbf5e6" stroke="#1d3344" stroke-width="2"/>' +
      '<path d="M150 30v140" stroke="#c9b98f" stroke-width="3"/>' +
      place(fishSvg(a.art, { key: 'il-a', still: true }), 46, 36, 96) +
      place(fishSvg(b.art, { key: 'il-b', still: true }), 46, 94, 96) +
      '<path d="M50 92h84M50 150h84M50 158h60" stroke="#8a7a5a" stroke-width="2" stroke-linecap="round"/>' +
      `<g color="#c9b98f">${place(fishSvg(c.art, { key: 'il-c', silhouette: true }), 160, 40, 92)}</g>` +
      '<text x="206" y="130" font-family="serif" font-size="40" fill="#c9b98f" text-anchor="middle">?</text>' +
      '<path d="M164 150h84M164 158h50" stroke="#e6dcc0" stroke-width="2" stroke-linecap="round"/>' +
      '</g>' +
      '<g transform="rotate(30 250 160)"><rect x="226" y="150" width="60" height="8" rx="4" fill="#e8a82e"/><path d="M286 150l10 4-10 4z" fill="#1d3344"/></g>',
  );
}

function fosse(): string {
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const x = 20 + ((i * 97) % 260);
    const y = 96 + ((i * 53) % 96);
    dots += `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.6}" fill="#6af0e0" opacity="${0.25 + (i % 4) * 0.18}"/>`;
  }
  return frame(
    '<defs><linearGradient id="il-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f5f80"/><stop offset="0.5" stop-color="#0f2a4a"/><stop offset="1" stop-color="#05081a"/></linearGradient><radialGradient id="il-glow"><stop offset="0" stop-color="#bff8f0" stop-opacity="0.95"/><stop offset="0.4" stop-color="#6af0e0" stop-opacity="0.45"/><stop offset="1" stop-color="#6af0e0" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="300" height="200" fill="#16233f"/>' +
      '<g fill="#ffffff"><circle cx="40" cy="20" r="1.200"/><circle cx="110" cy="12" r="1"/><circle cx="180" cy="26" r="1.400"/><circle cx="250" cy="14" r="1"/><circle cx="280" cy="34" r="1.200"/><circle cx="76" cy="38" r="0.900"/></g>' +
      '<path d="M236 24a14 14 0 1012 20 11 11 0 01-12-20z" fill="#f6ecd2"/>' +
      '<rect y="54" width="300" height="146" fill="url(#il-deep)"/>' +
      '<path d="M0 54q18.750-7 37.500 0t37.500 0 37.500 0 37.500 0 37.500 0 37.500 0 37.500 0 37.500 0" fill="none" stroke="#7fd0e0" stroke-width="2" opacity="0.6"/>' +
      '<path d="M128 46h44l-6 12h-32z" fill="#c94a3a" stroke="#0a1020" stroke-width="2" stroke-linejoin="round"/><path d="M150 46V28M152 30l12 13h-12z" stroke="#0a1020" stroke-width="2" fill="#f6ecd2" stroke-linejoin="round"/>' +
      '<path d="M150 58V150" stroke="#f6ecd2" stroke-width="0.800" opacity="0.6"/>' +
      '<path d="M0 200V130l34 26 22 44zM300 200V120l-40 34-18 46z" fill="#05081a"/>' +
      '<ellipse cx="150" cy="158" rx="110" ry="46" fill="url(#il-glow)"/>' +
      '<path d="M96 160c18-20 62-24 92-6l22-12v38l-22-12c-30 16-74 12-92-8z" fill="#0b1836" stroke="#8af0f0" stroke-width="2" stroke-linejoin="round"/><circle cx="116" cy="156" r="5" fill="#f0e88a"/>' +
      dots,
  );
}

export type IllustrationId = 'letter' | 'boat' | 'journal' | 'fosse';

export function illustrationSvg(id: IllustrationId): string {
  const svg = id === 'letter' ? letter() : id === 'boat' ? boat() : id === 'journal' ? journal() : fosse();
  return svg.replace(/(\d)\.(\d)00\b/g, '$1.$2').replace(/(\d)\.(\d)50\b/g, '$1.$25');
}

/** Game logo mark (wave + bobber), also used for the app icon. */
export function logoMarkSvg(size = 96): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#1f6f8f"/><circle cx="68" cy="30" r="10" fill="#fdebc0"/><path d="M2 58c12-12 24-12 36 0s24 12 36 0 16-10 24-6v28a48 48 0 01-96-6z" fill="#3fb0c6"/><path d="M2 70c12-10 24-10 36 0s24 10 36 0 16-8 24-4a48 48 0 01-96 6z" fill="#fbf5e6" opacity="0.9"/><path d="M50 26v20" stroke="#fbf5e6" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="56" r="11" fill="#fbf5e6"/><path d="M39 56a11 11 0 0122 0z" fill="#e2543e"/></svg>`;
}
