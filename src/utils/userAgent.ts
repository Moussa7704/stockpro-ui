/**
 * Description lisible d'un navigateur à partir de son User-Agent : « Chrome sur Android ».
 * Approximatif par nature (le navigateur annonce ce qu'il veut) : sert seulement à reconnaître
 * ses appareils dans la liste.
 */

export type DeviceKind = 'mobile' | 'tablet' | 'desktop'

export interface DeviceDescription {
  label: string
  kind: DeviceKind
}

// Ordre important : Edge et Opera s'annoncent aussi « Chrome », Chrome s'annonce aussi « Safari »
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

export function describeUserAgent(userAgent: string | null): DeviceDescription {
  if (!userAgent) return { label: 'Appareil inconnu', kind: 'desktop' }
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const kind: DeviceKind = /iPad|Tablet/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) ? 'tablet' : /Mobile|iPhone|iPod/.test(userAgent) ? 'mobile' : 'desktop'
  const label = browser && system ? `${browser} sur ${system}` : (browser ?? system ?? 'Appareil inconnu')
  return { label, kind }
}
