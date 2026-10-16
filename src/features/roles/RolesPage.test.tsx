import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { PermissionGroup, Role } from '../../types/access'

const groups: PermissionGroup[] = [
  { label: 'Caisse', permissions: [{ code: 'sales.create', label: 'Vendre' }, { code: 'sales.discount', label: 'Accorder des remises' }] },
]

const baseRoles: Role[] = [
  { id: 'r-owner', code: 'owner', name: 'Propriétaire', description: null, isSystem: true, permissions: [], memberCount: 1, editable: false },
  { id: 'r-cashier', code: 'cashier', name: 'Caissier', description: null, isSystem: true, permissions: ['sales.create'], memberCount: 2, editable: true },
  { id: 'r-delivery', code: 'livreur', name: 'Livreur', description: 'Tournées', isSystem: false, permissions: ['sales.create'], memberCount: 0, editable: true },
  { id: 'r-senior', code: 'vendeur_senior', name: 'Vendeur senior', description: null, isSystem: false, permissions: ['sales.create'], memberCount: 3, editable: true },
]

/** Fausse API avec état : création et suppression modifient ce que renvoie la liste ensuite. */
function mockRolesApi() {
  const db = { roles: [...baseRoles] }
  server.use(
    mock.get('/api/roles', () => HttpResponse.json({ roles: db.roles })),
    mock.get('/api/permissions', () => HttpResponse.json({ groups })),
    mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })),
  )
  return db
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement

describe('Page Rôles', () => {
  it('rôles de base repérés, propriétaire non modifiable, suppression bloquée si le rôle est attribué', async () => {
    mockRolesApi()
    renderApp('/roles')

    const owner = await rowOf('Propriétaire')
    expect(within(owner).getByText('de base')).toBeInTheDocument()
    expect(within(owner).getByRole('button', { name: 'Modifier Propriétaire' })).toBeDisabled()
    // Rôle de base : pas de suppression ; rôle personnalisé attribué : suppression désactivée
    expect(within(await rowOf('Caissier')).queryByRole('button', { name: 'Supprimer Caissier' })).not.toBeInTheDocument()
    expect(within(await rowOf('Vendeur senior')).getByRole('button', { name: 'Supprimer Vendeur senior' })).toBeDisabled()
  })

  it('crée un rôle personnalisé en cochant ses permissions', async () => {
    const db = mockRolesApi()
    let sent: unknown = null
    server.use(
      mock.post('/api/roles', async ({ request }) => {
        sent = await request.json()
        const role: Role = { id: 'r-new', code: 'caissier_chef', name: 'Caissier chef', description: null, isSystem: false, permissions: ['sales.create', 'sales.discount'], memberCount: 0, editable: true }
        db.roles.push(role)
        return HttpResponse.json({ role }, { status: 201 })
      }),
    )
    const { user } = renderApp('/roles')

    await user.click(await screen.findByRole('button', { name: /Nouveau rôle/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom'), 'Caissier chef')
    await user.click(within(dialog).getByRole('checkbox', { name: /Vendre/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /remises/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Créer le rôle' }))

    expect(await screen.findByText('Rôle « Caissier chef » créé')).toBeInTheDocument()
    expect(sent).toMatchObject({ name: 'Caissier chef', permissions: ['sales.create', 'sales.discount'] })
    expect(await screen.findByText('Caissier chef')).toBeInTheDocument()
  })

  it('supprime un rôle personnalisé inutilisé après confirmation', async () => {
    const db = mockRolesApi()
    let deleted = false
    server.use(
      mock.delete('/api/roles/r-delivery', () => {
        deleted = true
        db.roles = db.roles.filter((role) => role.id !== 'r-delivery')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/roles')

    await user.click(within(await rowOf('Livreur')).getByRole('button', { name: 'Supprimer Livreur' }))
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Rôle « Livreur » supprimé')).toBeInTheDocument()
    expect(deleted).toBe(true)
    await waitFor(() => expect(screen.queryByText('Tournées')).not.toBeInTheDocument())
  })

  it('suppression refusée par le serveur : son message est affiché', async () => {
    mockRolesApi()
    server.use(
      mock.delete('/api/roles/r-delivery', () =>
        HttpResponse.json({ error: { message: 'Ce rôle est attribué à 1 membre(s) : changez d’abord leur rôle' } }, { status: 409 }),
      ),
    )
    const { user } = renderApp('/roles')

    await user.click(within(await rowOf('Livreur')).getByRole('button', { name: 'Supprimer Livreur' }))
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText(/changez d’abord leur rôle/)).toBeInTheDocument()
    expect(screen.getByText('Livreur')).toBeInTheDocument()
  })
})
