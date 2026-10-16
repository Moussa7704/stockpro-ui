import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { Member, MemberPermissions, PermissionGroup, Role } from '../../types/access'

function member(overrides: Partial<Member> & { name: string }): Member {
  const { name, ...rest } = overrides
  return {
    id: `m-${name}`,
    user: { id: `u-${name}`, name, email: `${name.toLowerCase()}@test.com`, invitationPending: false },
    role: { code: 'cashier', name: 'Caissier' },
    allShops: false,
    shops: [shopsFixture[0]!],
    status: 'active',
    permissionOverrides: { grants: [], revokes: [] },
    permissions: ['sales.create'],
    editable: true,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...rest,
  }
}

const roles: Role[] = [
  { id: 'r-owner', code: 'owner', name: 'Propriétaire', description: null, isSystem: true, permissions: [], memberCount: 1, editable: false },
  { id: 'r-keeper', code: 'stock_keeper', name: 'Gestionnaire de stock', description: null, isSystem: true, permissions: ['stock.view', 'stock.adjust'], memberCount: 1, editable: true },
]

const groups: PermissionGroup[] = [
  { label: 'Stock', permissions: [{ code: 'stock.view', label: 'Voir le stock' }, { code: 'stock.adjust', label: 'Ajuster le stock' }] },
  { label: 'Caisse', permissions: [{ code: 'sales.create', label: 'Vendre' }, { code: 'cash_sessions.manage', label: 'Ouvrir et clôturer une session de caisse' }] },
]

const team = [
  member({ name: 'Moussa', role: { code: 'owner', name: 'Propriétaire' }, editable: false, allShops: true, shops: [] }),
  member({ name: 'Fatou', role: { code: 'stock_keeper', name: 'Gestionnaire de stock' }, permissions: ['stock.view', 'stock.adjust'] }),
  member({ name: 'Ibrahima', user: { id: 'u-i', name: 'Ibrahima', email: 'ibrahima@test.com', invitationPending: true } }),
]

function useTeamApi(members: Member[] = team) {
  server.use(
    mock.get('/api/members', () => HttpResponse.json({ members })),
    mock.get('/api/roles', () => HttpResponse.json({ roles })),
    mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })),
    mock.get('/api/permissions', () => HttpResponse.json({ groups })),
  )
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement

describe('Page Équipe', () => {
  it('liste les membres, leur statut, et désactive ce qu’on ne peut pas modifier', async () => {
    useTeamApi()
    renderApp('/members')

    const owner = await rowOf('Moussa')
    expect(within(owner).getByRole('button', { name: 'Modifier Moussa' })).toBeDisabled()
    expect(within(await rowOf('Fatou')).getByRole('button', { name: 'Modifier Fatou' })).toBeEnabled()
    expect(within(await rowOf('Ibrahima')).getByText('Invitation en attente')).toBeInTheDocument()
  })

  it('renvoie une invitation en attente', async () => {
    useTeamApi()
    let resent = false
    server.use(
      mock.post('/api/members/m-Ibrahima/invite', () => {
        resent = true
        return HttpResponse.json({ message: 'Invitation renvoyée' })
      }),
    )
    const { user } = renderApp('/members')

    await user.click(within(await rowOf('Ibrahima')).getByRole('button', { name: /Renvoyer l’invitation/ }))

    expect(await screen.findByText('Invitation renvoyée à ibrahima@test.com')).toBeInTheDocument()
    expect(resent).toBe(true)
  })

  it('affiche l’erreur du serveur si la liste ne se charge pas', async () => {
    useTeamApi()
    server.use(mock.get('/api/members', () => HttpResponse.json({ error: { message: "Vous n'avez pas les droits pour cette action" } }, { status: 403 })))
    renderApp('/members')

    expect(await screen.findByText("Vous n'avez pas les droits pour cette action")).toBeInTheDocument()
  })

  it('donne la caisse au gestionnaire de stock : ajouts envoyés, puis l’équipe est relue', async () => {
    let memberListCalls = 0
    let sentBody: unknown = null
    const details: MemberPermissions = {
      memberId: 'm-Fatou',
      role: { code: 'stock_keeper', name: 'Gestionnaire de stock', permissions: ['stock.view', 'stock.adjust'] },
      grants: [],
      revokes: [],
      permissions: ['stock.view', 'stock.adjust'],
      editable: true,
      grantable: ['stock.view', 'stock.adjust', 'sales.create', 'cash_sessions.manage'],
    }
    useTeamApi()
    server.use(
      mock.get('/api/members', () => {
        memberListCalls += 1
        return HttpResponse.json({ members: team })
      }),
      mock.get('/api/members/m-Fatou/permissions', () => HttpResponse.json({ permissions: details })),
      mock.put('/api/members/m-Fatou/permissions', async ({ request }) => {
        sentBody = await request.json()
        return HttpResponse.json({
          permissions: { ...details, grants: ['cash_sessions.manage', 'sales.create'], permissions: [...details.permissions, 'sales.create', 'cash_sessions.manage'] },
        })
      }),
    )
    const { user } = renderApp('/members', { session: meResponse({ permissions: ['users.manage'] }) })

    await user.click(within(await rowOf('Fatou')).getByRole('button', { name: 'Droits de Fatou' }))
    const drawer = await screen.findByRole('dialog')
    await user.click(await within(drawer).findByRole('checkbox', { name: /Vendre/ }))
    await user.click(within(drawer).getByRole('checkbox', { name: /session de caisse/ }))
    expect(within(drawer).getAllByText('ajouté')).toHaveLength(2)
    await user.click(within(drawer).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Droits mis à jour')).toBeInTheDocument()
    expect(sentBody).toEqual({ grants: ['sales.create', 'cash_sessions.manage'], revokes: [] })
    await waitFor(() => expect(memberListCalls).toBe(2))
  })

  it('droits en lecture seule : cases désactivées, pas de bouton Enregistrer', async () => {
    useTeamApi()
    server.use(
      mock.get('/api/members/m-Moussa/permissions', () =>
        HttpResponse.json({
          permissions: {
            memberId: 'm-Moussa',
            role: { code: 'owner', name: 'Propriétaire', permissions: ['stock.view'] },
            grants: [],
            revokes: [],
            permissions: ['stock.view'],
            editable: false,
            grantable: [],
          } satisfies MemberPermissions,
        }),
      ),
    )
    const { user } = renderApp('/members')

    await user.click(within(await rowOf('Moussa')).getByRole('button', { name: 'Droits de Moussa' }))
    const drawer = await screen.findByRole('dialog')

    expect(await within(drawer).findByText('Lecture seule')).toBeInTheDocument()
    expect(within(drawer).getByRole('checkbox', { name: /Voir le stock/ })).toBeDisabled()
    expect(within(drawer).queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument()
  })
})
