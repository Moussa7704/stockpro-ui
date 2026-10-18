/**
 * Fichier d'écran introuvable : l'application a été mise à jour pendant que la page était ouverte
 * (les fichiers de l'ancienne version n'existent plus). Recharger suffit. Messages de Chrome/Edge,
 * Safari et Firefox.
 */
export function isOutdatedChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message)
}
