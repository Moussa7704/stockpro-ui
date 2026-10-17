/** Fuseaux proposés : l'Afrique d'abord (clientèle visée), puis tous les autres. */
export function timezoneOptions(current?: string) {
  const all = Intl.supportedValuesOf('timeZone')
  const zones = !current || all.includes(current) ? all : [current, ...all]
  const africa = zones.filter((zone) => zone.startsWith('Africa/'))
  const others = zones.filter((zone) => !zone.startsWith('Africa/'))
  const toOption = (zone: string) => ({ value: zone, label: zone.replaceAll('_', ' ') })
  return [
    { label: 'Afrique', options: africa.map(toOption) },
    { label: 'Autres fuseaux', options: others.map(toOption) },
  ]
}
