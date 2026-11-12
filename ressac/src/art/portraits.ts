import type { CharacterId } from '../data/types';

/** Stylised character portraits, drawn in SVG (100 × 100). */
const open = (bg: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="portrait" role="img"><circle cx="50" cy="50" r="48" fill="${bg}"/><clipPath id="pc"><circle cx="50" cy="50" r="48"/></clipPath><g clip-path="url(#pc)">`;
const close = '</g><circle cx="50" cy="50" r="48" fill="none" stroke="#1d3344" stroke-width="3"/></svg>';

function face(skin: string, shade: string, eyeY = 50): string {
  return (
    `<path d="M30 46c0-14 9-22 20-22s20 8 20 22c0 15-8 26-20 26S30 61 30 46z" fill="${skin}"/>` +
    `<ellipse cx="33" cy="52" rx="4" ry="6" fill="${shade}"/><ellipse cx="67" cy="52" rx="4" ry="6" fill="${shade}"/>` +
    `<circle cx="42" cy="${eyeY}" r="2.6" fill="#1d3344"/><circle cx="58" cy="${eyeY}" r="2.6" fill="#1d3344"/>`
  );
}

function herve(): string {
  return (
    open('#9ccbd6') +
    '<path d="M12 104c2-22 16-30 38-30s36 8 38 30z" fill="#27496b"/>' +
    '<path d="M36 76l14 12 14-12-4-6H40z" fill="#f2efe6"/><path d="M40 80h20M42 84h16" stroke="#c94a3a" stroke-width="2.5"/>' +
    face('#e0a988', '#c98d6c', 49) +
    // Beard and moustache.
    '<path d="M30 52c0 18 9 28 20 28s20-10 20-28c-4 8-10 9-14 8H44c-4 1-10 0-14-8z" fill="#f4f1ea"/>' +
    '<path d="M40 60c4-4 8-4 10-1 2-3 6-3 10 1-4 3-7 3-10 1-3 2-6 2-10-1z" fill="#ffffff"/>' +
    '<path d="M36 44l9-2M64 44l-9-2" stroke="#f4f1ea" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M47 54q3 3 6 0" stroke="#c98d6c" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    // Captain cap.
    '<path d="M27 34c2-14 12-20 23-20s21 6 23 20z" fill="#1d3344"/><path d="M24 35c8-5 44-5 52 0l-2 6c-12-5-36-5-48 0z" fill="#12222f"/>' +
    '<circle cx="50" cy="25" r="5" fill="#e8a82e"/><path d="M50 21.500v7M47 25h6" stroke="#1d3344" stroke-width="1.6"/>' +
    close
  );
}

function jo(): string {
  return (
    open('#f3d9a4') +
    '<path d="M12 104c2-22 16-30 38-30s36 8 38 30z" fill="#e8e0d0"/>' +
    '<path d="M34 78h32l4 26H30z" fill="#2f8a6a"/><path d="M40 78v-4M60 78v-4" stroke="#2f8a6a" stroke-width="4"/>' +
    // Hair behind.
    '<path d="M26 50c-3-20 8-32 24-32s27 12 24 32c-1 8-4 12-6 14V42H32v22c-2-2-5-6-6-14z" fill="#b5532c"/>' +
    '<circle cx="50" cy="14" r="10" fill="#b5532c"/>' +
    face('#f2c6a4', '#e0aa86', 50) +
    '<path d="M30 42c4-12 14-16 22-14 8-2 16 4 18 14-8-2-12-6-16-10-6 6-14 9-24 10z" fill="#b5532c"/>' +
    '<circle cx="38" cy="56" r="1" fill="#c98d6c"/><circle cx="41" cy="58.500" r="1" fill="#c98d6c"/><circle cx="62" cy="56" r="1" fill="#c98d6c"/><circle cx="59" cy="58.500" r="1" fill="#c98d6c"/>' +
    '<path d="M43 62q7 6 14 0" stroke="#a8452e" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M37 45l8-1M63 45l-8-1" stroke="#8a3f20" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="30" cy="60" r="3" fill="#e8a82e"/><circle cx="70" cy="60" r="3" fill="#e8a82e"/>' +
    close
  );
}

function nell(): string {
  return (
    open('#bfe3c8') +
    '<path d="M12 104c2-22 16-30 38-30s36 8 38 30z" fill="#e2543e"/>' +
    '<path d="M42 74l8 8 8-8" fill="none" stroke="#f6e9c8" stroke-width="4" stroke-linecap="round"/>' +
    // Curly hair.
    '<g fill="#2a1d1a"><circle cx="31" cy="38" r="10"/><circle cx="40" cy="27" r="11"/><circle cx="54" cy="23" r="12"/><circle cx="66" cy="31" r="11"/><circle cx="71" cy="43" r="9"/><circle cx="28" cy="50" r="7"/><circle cx="72" cy="52" r="6"/></g>' +
    face('#8a5a3c', '#734a30', 51) +
    '<circle cx="42" cy="51" r="6.500" fill="none" stroke="#f6e9c8" stroke-width="2"/><circle cx="58" cy="51" r="6.500" fill="none" stroke="#f6e9c8" stroke-width="2"/><path d="M48.500 51h3" stroke="#f6e9c8" stroke-width="2"/>' +
    '<path d="M44 62q6 5 12 0" stroke="#4a2a1c" stroke-width="2.400" fill="none" stroke-linecap="round"/>' +
    // Bandana and pencil.
    '<path d="M28 40c6-10 38-12 46-1l-2 6c-10-7-32-6-42 1z" fill="#e8a82e"/>' +
    '<path d="M70 30l10-14" stroke="#e8c36a" stroke-width="4" stroke-linecap="round"/><path d="M80 16l2-4-4 1z" fill="#1d3344"/>' +
    close
  );
}

function maelle(): string {
  return (
    open('#d9c9a8') +
    '<g transform="rotate(-8 50 52)">' +
    '<rect x="24" y="20" width="54" height="66" rx="5" fill="#7a4a2c"/>' +
    '<rect x="29" y="20" width="49" height="66" rx="4" fill="#9a6238"/>' +
    '<rect x="34" y="27" width="40" height="52" rx="2" fill="#f6ecd2"/>' +
    '<path d="M39 42c5-7 14-8 20-3l7-4v13l-7-4c-6 5-15 4-20-2z" fill="none" stroke="#1d3344" stroke-width="2.200" stroke-linejoin="round"/><circle cx="45" cy="40.500" r="1.200" fill="#1d3344"/>' +
    '<path d="M39 56h30M39 62h26M39 68h18" stroke="#8a7a5a" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M24 34h8M24 48h8M24 62h8M24 76h8" stroke="#f0c36a" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M70 20v22l4-4 4 4V20z" fill="#e2543e"/>' +
    '</g>' +
    close
  );
}

const cache = new Map<CharacterId, string>();

export function portraitSvg(who: CharacterId): string {
  let svg = cache.get(who);
  if (!svg) {
    svg = (who === 'herve' ? herve() : who === 'jo' ? jo() : who === 'nell' ? nell() : maelle()).replace(/(\d)\.(\d)00\b/g, '$1.$2');
    // Each portrait needs its own clip id when several are on screen.
    svg = svg.split('"pc"').join(`"pc-${who}"`).split('url(#pc)').join(`url(#pc-${who})`);
    cache.set(who, svg);
  }
  return svg;
}
