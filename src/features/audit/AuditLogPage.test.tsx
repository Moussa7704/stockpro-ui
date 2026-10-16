import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { AuditLogEntry } from '../../types/settings'

const entries: AuditLogEntry[] = [
  {
    id: 'a1',
    shopId: null,
    action: 'member.permissions_update',
    entityType: 'membership',
    entityId: 'm1',
    before: { grants: [], revokes: [] },
    after: { grants: ['sales.create'], revokes: [] },
    ip: null,
    createdAt: '2026-10-16T09:30:00.000Z',
    actor: { id: 'u1', name: 'Awa Diop', email: 'awa@test.com' },
  },
  {
    id: 'a2',
    shopId: null,
    action: 'supplier.archive',
    entityType: 'supplier',
    entityId: 'sup1',
    before: { name: 'Grossiste', archivedAt: null },
    after: { name: 'Grossiste', archivedAt: '2026-10-16' },
    ip: null,
    createdAt: '2026-10-16T08:00:00.000Z',
    actor: null,
  },
]

function useAuditApi() {
  const calls: URLSearchParams[] = []
  server.use(
    mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })),
    mock.get('/api/audit-logs', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.push(params)
      const items = params.get('entityType') ? entries.filter((entry) => entry.entityType === params.get('entityType')) : entries
      return HttpResponse.json({ items, total: 45, page: Number(params.get('page')), pageSize: 20 })
    }),
  )
  return calls
}

const session = meResponse({ permissions: ['audit.view'] })

describe('Journal d’audit', () => {
  it('affiche les actions en français, avec l’auteur (ou « Système »)', async () => {
    useAuditApi()
    renderApp('/audit', { session })

    expect(await screen.findByText('Droits d’un membre ajustés')).toBeInTheDocument()
    // Action générique reconstruite : élément + suffixe
    expect(screen.getByText('Fournisseur archivé(e)')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Awa Diop')).toBeInTheDocument()
    expect(within(table).getByText('Système')).toBeInTheDocument()
    expect(screen.getByText('45 entrée(s)')).toBeInTheDocument()
  })

  it('détaille l’avant / après en masquant ce qui n’a pas changé', async () => {
    useAuditApi()
    const { user } = renderApp('/audit', { session })

    const row = (await screen.findByText('Fournisseur archivé(e)')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: /développer|expand/i }))

    expect(await screen.findByText('Archivé le')).toBeInTheDocument()
    expect(screen.getByText('2026-10-16')).toBeInTheDocument()
    // Le nom n'a pas changé : il n'apparaît pas dans le détail
    expect(screen.queryByRole('cell', { name: 'Nom' })).not.toBeInTheDocument()
  })

  it('filtre par élément et pagine côté serveur', async () => {
    const calls = useAuditApi()
    const { user } = renderApp('/audit', { session })
    await screen.findByText('Droits d’un membre ajustés')

    await user.click(screen.getByRole('listitem', { name: '2' }))
    await waitFor(() => expect(calls.at(-1)?.get('page')).toBe('2'))

    await user.click(screen.getByLabelText('Filtrer par élément'))
    await user.click(await screen.findByTitle('Fournisseur'))
    await waitFor(() => expect(calls.at(-1)?.get('entityType')).toBe('supplier'))
    // Un nouveau filtre repart de la première page
    expect(calls.at(-1)?.get('page')).toBe('1')
    await waitFor(() => expect(screen.queryByText('Droits d’un membre ajustés')).not.toBeInTheDocument())
  })
})
