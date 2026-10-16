import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockCustomersApi } from '../../test/customersApi'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { mockStockApi } from '../../test/stockApi'

const manager = meResponse({ permissions: ['expenses.manage', 'cash_sessions.manage'] })

function setup(options?: Parameters<typeof mockCustomersApi>[0]) {
  mockStockApi()
  return mockCustomersApi(options)
}

async function fillExpense(user: ReturnType<typeof renderApp>['user'], modal: HTMLElement) {
  await user.click(within(modal).getByLabelText('Catégorie'))
  await user.click(await screen.findByTitle('Électricité et eau'))
  await user.type(within(modal).getByLabelText('Montant'), '15000')
  await user.type(within(modal).getByLabelText('Description'), 'Facture d’électricité')
}

describe('Dépenses', () => {
  it('payée depuis le tiroir quand ma caisse est ouverte ; total de la liste', async () => {
    const { lastRequest } = setup({ sessionOpen: true })
    const { user } = renderApp('/expenses', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Nouvelle dépense/ }))
    const modal = await screen.findByRole('dialog')
    await fillExpense(user, modal)
    await user.click(await within(modal).findByRole('switch', { name: 'Payée depuis le tiroir-caisse' }))
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer la dépense' }))

    expect(await screen.findByText('Dépense BTQ1-DEP-2026-000001 enregistrée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/expenses')).toMatchObject({
      body: { shopId: 'shop-1', categoryId: 'cat-power', amount: '15000', description: 'Facture d’électricité', cashSessionId: 'cs-1' },
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    expect(await screen.findByText('Total (hors annulées)')).toBeInTheDocument()
    // La colonne « Paiement » (étiquette « tiroir ») n'apparaît que sur un écran moyen ou large
    expect(screen.getAllByText('15 000 FCFA').length).toBeGreaterThan(0)
  })

  it('sans caisse ouverte : le paiement depuis le tiroir est impossible', async () => {
    const { lastRequest } = setup({ sessionOpen: false })
    const { user } = renderApp('/expenses', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Nouvelle dépense/ }))
    const modal = await screen.findByRole('dialog')
    await fillExpense(user, modal)
    expect(within(modal).getByRole('switch', { name: 'Payée depuis le tiroir-caisse' })).toBeDisabled()
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer la dépense' }))

    await screen.findByText('Dépense BTQ1-DEP-2026-000001 enregistrée')
    expect(lastRequest('POST', '/api/expenses')?.body).toMatchObject({ cashSessionId: null })
  })

  it('annulation avec un motif obligatoire', async () => {
    const { lastRequest } = setup({ sessionOpen: false })
    const { user } = renderApp('/expenses', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Nouvelle dépense/ }))
    const modal = await screen.findByRole('dialog')
    await fillExpense(user, modal)
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer la dépense' }))
    await screen.findByText('Dépense BTQ1-DEP-2026-000001 enregistrée')

    await user.click(await screen.findByRole('button', { name: 'Annuler BTQ1-DEP-2026-000001' }))
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!
    expect(within(confirm).getByRole('button', { name: 'Annuler la dépense' })).toBeDisabled()
    await user.type(within(confirm).getByLabelText('Motif de l’annulation'), 'Saisie en double')
    await user.click(within(confirm).getByRole('button', { name: 'Annuler la dépense' }))

    expect(await screen.findByText('Dépense BTQ1-DEP-2026-000001 annulée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/expenses/exp-1/cancel')?.body).toEqual({ reason: 'Saisie en double' })
    await waitFor(() => expect(screen.getByText('Annulée')).toBeInTheDocument())
  })

  it('crée une catégorie de dépenses', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/expenses', { session: manager })

    await user.click(await screen.findByText('Catégories'))
    await user.click(await screen.findByRole('button', { name: /Nouvelle catégorie/ }))
    await user.type(await screen.findByLabelText('Nom de la catégorie'), 'Gardiennage')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Catégorie « Gardiennage » enregistrée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/expenses/categories')?.body).toEqual({ name: 'Gardiennage' })
  })
})
