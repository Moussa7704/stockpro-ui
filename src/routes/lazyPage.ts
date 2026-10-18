import { lazy, type ComponentType } from 'react'

const loaders: (() => Promise<unknown>)[] = []

/**
 * Écran chargé à la demande (un fichier par écran) : le navigateur ne télécharge que les écrans
 * ouverts. Nos écrans sont des exports nommés ; React.lazy attend un export par défaut.
 */
export function lazyPage<Module extends Record<Name, ComponentType>, Name extends string>(load: () => Promise<Module>, name: Name) {
  loaders.push(load)
  return lazy(async () => ({ default: (await load())[name] }))
}

/**
 * Charge tous les écrans d'avance. Réservé aux tests : sans ça, chaque écran serait compilé
 * pendant le test (plusieurs secondes) et dépasserait les délais d'attente.
 */
export async function preloadAllPages(): Promise<void> {
  await Promise.all(loaders.map((load) => load()))
}
