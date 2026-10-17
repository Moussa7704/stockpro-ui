/**
 * Couleur de l'interface choisie par l'entreprise (boutons, liens, menu actif). Même règle que
 * le serveur : le texte blanc des boutons doit rester lisible dessus (contraste WCAG ≥ 4,5:1).
 * Les couleurs d'état (rupture, erreur, hausse…) et celles des graphiques ne changent jamais.
 */

export const DEFAULT_BRAND_COLOR = '#4f46e5'
export const MIN_TEXT_CONTRAST = 4.5
export const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Couleurs proposées, toutes vérifiées (contraste avec le blanc entre 5,0 et 10,4). Pas de rouge vif : réservé aux erreurs. */
export const BRAND_PRESETS = [
  { name: 'Indigo StockPro', color: DEFAULT_BRAND_COLOR },
  { name: 'Bleu', color: '#1d4ed8' },
  { name: 'Sarcelle', color: '#0f766e' },
  { name: 'Vert', color: '#15803d' },
  { name: 'Orange', color: '#c2410c' },
  { name: 'Bordeaux', color: '#9f1239' },
  { name: 'Framboise', color: '#be185d' },
  { name: 'Violet', color: '#7e22ce' },
  { name: 'Brun', color: '#92400e' },
  { name: 'Ardoise', color: '#334155' },
] as const

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (light! + 0.05) / (dark! + 0.05)
}

/** Couleur au bon format et assez foncée pour du texte blanc. */
export function isReadableBrandColor(color: string): boolean {
  return HEX_COLOR.test(color) && contrastRatio(color, '#ffffff') >= MIN_TEXT_CONTRAST
}
