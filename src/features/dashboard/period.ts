import dayjs from 'dayjs'

/**
 * Période affichée par le tableau de bord : aujourd'hui (vue du jour), une date précise, un mois
 * ou une période libre. Les jours sont des chaînes AAAA-MM-JJ, les mois AAAA-MM.
 */
export type PeriodSelection =
  | { mode: 'today' }
  | { mode: 'day'; day: string }
  | { mode: 'month'; month: string }
  | { mode: 'range'; from: string; to: string }

export type PeriodMode = PeriodSelection['mode']

const DAY = 'YYYY-MM-DD'

/** Choix proposé en passant à un mode : hier, le mois dernier, les 7 derniers jours. */
export function defaultSelection(mode: PeriodMode, today = dayjs()): PeriodSelection {
  switch (mode) {
    case 'day':
      return { mode, day: today.subtract(1, 'day').format(DAY) }
    case 'month':
      return { mode, month: today.subtract(1, 'month').format('YYYY-MM') }
    case 'range':
      return { mode, from: today.subtract(6, 'day').format(DAY), to: today.format(DAY) }
    default:
      return { mode: 'today' }
  }
}

/** Bornes envoyées au serveur (aucune pour la vue du jour). Le mois en cours s'arrête à aujourd'hui. */
export function periodBounds(selection: PeriodSelection, today = dayjs()): { from?: string; to?: string } {
  switch (selection.mode) {
    case 'day':
      return { from: selection.day, to: selection.day }
    case 'month': {
      const start = dayjs(`${selection.month}-01`)
      const end = start.endOf('month')
      return { from: start.format(DAY), to: (end.isAfter(today, 'day') ? today : end).format(DAY) }
    }
    case 'range':
      return { from: selection.from, to: selection.to }
    default:
      return {}
  }
}

const longDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const longMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const utc = (day: string) => new Date(`${day}T12:00:00Z`)

/** Titre de la période : « Situation du 3 octobre 2026 », « … de septembre 2026 », « … du 1 au 17 octobre ». */
export function periodTitle(selection: PeriodSelection): string {
  switch (selection.mode) {
    case 'day':
      return `Situation du ${longDay.format(utc(selection.day))}`
    case 'month':
      return `Situation de ${longMonth.format(utc(`${selection.month}-01`))}`
    case 'range':
      return selection.from === selection.to
        ? `Situation du ${longDay.format(utc(selection.from))}`
        : `Situation du ${longDay.format(utc(selection.from))} au ${longDay.format(utc(selection.to))}`
    default:
      return 'Situation du jour'
  }
}

/** Libellé de la comparaison, d'après la période précédente renvoyée par le serveur. */
export function comparisonLabel(selection: PeriodSelection, previous: { from: string; to: string }): string {
  if (selection.mode === 'day' || (selection.mode === 'range' && selection.from === selection.to)) return 'vs veille'
  const wholeMonth = previous.from.endsWith('-01') && dayjs(previous.to).date() === dayjs(previous.to).daysInMonth()
  if (selection.mode === 'month' && wholeMonth) return `vs ${longMonth.format(utc(previous.from))}`
  return `vs ${dayjs(previous.from).format('DD/MM')} – ${dayjs(previous.to).format('DD/MM')}`
}
