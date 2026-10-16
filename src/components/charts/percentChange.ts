/** Variation en % entre deux montants (null si la base est nulle : pas de comparaison honnête). */
export function percentChange(current: string | number, previous: string | number): number | null {
  const base = Number(previous)
  return base === 0 ? null : ((Number(current) - base) / base) * 100
}
