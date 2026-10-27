/** Nom de fichier proposé par le serveur (Content-Disposition), sinon un nom par défaut. */
export function filenameFrom(header: string | undefined, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/)
  return match?.[1] ?? fallback
}

/** Fait enregistrer un fichier reçu de l'API (Excel, PDF…) par le navigateur. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
