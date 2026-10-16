/**
 * Jetons des graphiques (palette de référence, validée : contraste ≥ 3:1 sur le fond clair).
 * Une seule série par graphique → une seule couleur (emplacement 1), pas de légende :
 * le titre du graphique nomme la série. Grille et axes en filets discrets.
 */
export const chartTheme = {
  series1: '#2a78d6',
  series1Hover: '#256abf',
  grid: '#ebeae6',
  axisText: '#52514e',
  tooltipBackground: '#ffffff',
  tooltipBorder: '#e2e1dc',
} as const
