import coinsUrl from '../../assets/sounds/sale-coins.mp3'

/**
 * Son de pièces joué quand le serveur confirme une vente (jamais au clic : une vente refusée ne
 * sonne pas). Réglable sur chaque appareil : une caisse en boutique calme, une autre au marché.
 * Le navigateur l'autorise : il suit le clic « Encaisser » du caissier.
 */

const STORAGE_KEY = 'stockpro:pos-sale-sound'
// Le fichier est enregistré fort (crête à 0 dB) : assez pour un marché, sans faire sursauter
const VOLUME = 0.6

let audio: HTMLAudioElement | null = null

/** Activé par défaut ; stockage indisponible (navigation privée) → activé. */
export function isSaleSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSaleSoundEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, 'off')
  } catch {
    // stockage indisponible : le réglage vaut pour cette visite seulement
  }
}

/** Prépare le son à l'ouverture de la caisse : il part sans délai à la première vente. */
export function preloadSaleSound(): void {
  if (audio || typeof Audio === 'undefined') return
  audio = new Audio(coinsUrl)
  audio.preload = 'auto'
  audio.volume = VOLUME
}

export function playSaleSound(): void {
  if (!isSaleSoundEnabled()) return
  try {
    preloadSaleSound()
    if (!audio) return
    // Deux ventes rapprochées : le son repart du début
    audio.currentTime = 0
    // Lecture refusée (réglage du navigateur, aucun haut-parleur) : la vente est faite, on ignore
    void audio.play()?.catch(() => undefined)
  } catch {
    // Audio indisponible : sans conséquence
  }
}
