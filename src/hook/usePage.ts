import { useState } from 'react'

/**
 * Page courante d'une liste, remise à 1 quand resetKey change (ex. la boutique choisie en haut :
 * la page 3 d'une boutique n'a pas de sens dans une autre). Les autres filtres restent en place.
 */
export function usePage(resetKey: unknown): [number, (page: number) => void] {
  const [state, setState] = useState({ page: 1, resetKey })
  // Ajustement pendant le rendu (pas d'effet) : aucune requête n'est lancée avec l'ancienne page
  if (state.resetKey !== resetKey) setState({ page: 1, resetKey })
  const page = state.resetKey === resetKey ? state.page : 1
  return [page, (next) => setState({ page: next, resetKey })]
}
