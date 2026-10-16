import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockCustomersApi } from '../../test/customersApi'
import { meResponse } from '../../test/fixtures'
import { mobileMethod } from '../../test/posApi'
import { renderApp } from '../../test/render'
import { mockStockApi } from '../../test/stockApi'

const cashier = meResponse({ permissions: ['customers.manage', 'customer_payments.manage', 'sales.create'], roleCode: 'cashier' })
const manager = meResponse({ permissions: ['customers.manage', 'customer_payments.manage', 'reports.view', 'expenses.manage'] })

function setup(options?: Parameters<typeof mockCustomersApi>[0]) {
  mockStockApi()
  return mockCustomersApi(options)
}

describe('Clients', () => {
  it('recherche, filtre « avec une dette » et ouverture de la fiche', async () => {
    const { lastRequest } = setup()
    const { user, router } = renderApp('/customers', { session: cashier })

    expect(await screen.findByText('Ibrahima Fall')).toBeInTheDocument()
    await user.click(screen.getByText('Avec une dette'))
    await waitFor(() => expect(lastRequest('GET', '/api/customers')?.search).toContain('withDebt=true'))
    await waitFor(() => expect(screen.queryByText('Ibrahima Fall')).not.toBeInTheDocument())

    await user.click(screen.getByText('Awa Ndiaye'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers/cu-awa'))
    expect(await screen.findByText('Dette actuelle')).toBeInTheDocument()
  })

  it('caissier : pas de plafond de crédit dans le formulaire (et jamais envoyé)', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/customers', { session: cashier })

    await user.click(await screen.findByRole('button', { name: /Nouveau client/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).queryByLabelText('Vente à crédit autorisée')).not.toBeInTheDocument()
    await user.type(within(modal).getByLabelText('Nom'), 'Moussa Diop')
    await user.click(within(modal).getByRole('button', { name: 'Créer le client' }))

    expect(await screen.findByText('Client « Moussa Diop » créé')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/customers')?.body).not.toHaveProperty('creditLimit')
  })

  it('gérant : autorise le crédit avec un plafond', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/customers', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Nouveau client/ }))
    const modal = await screen.findByRole('dialog')
    await user.type(within(modal).getByLabelText('Nom'), 'Fatou Sow')
    await user.click(within(modal).getByLabelText('Vente à crédit autorisée'))
    await user.type(await within(modal).findByLabelText('Plafond de crédit'), '25000')
    await user.click(within(modal).getByRole('button', { name: 'Créer le client' }))

    await screen.findByText('Client « Fatou Sow » créé')
    expect(lastRequest('POST', '/api/customers')?.body).toMatchObject({ name: 'Fatou Sow', creditLimit: '25000' })
  })
})

describe('Fiche client : règlement de dette', () => {
  it('espèces sans caisse ouverte : refusé ; Mobile Money : encaissé, jamais plus que la dette', async () => {
    const { lastRequest } = setup({ sessionOpen: false })
    const { user } = renderApp('/customers/cu-awa', { session: cashier })

    await user.click(await screen.findByRole('button', { name: /Encaisser un règlement/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByLabelText('Montant reçu')).toHaveValue('30 000')
    expect(await within(modal).findByText(/Ouvrez votre caisse dans cette boutique/)).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Encaisser' })).toBeDisabled()

    await user.click(within(modal).getByLabelText('Moyen de paiement'))
    await user.click(await screen.findByTitle(mobileMethod.name))
    const amount = within(modal).getByLabelText('Montant reçu')
    await user.clear(amount)
    await user.type(amount, '40000')
    expect(within(modal).getByText('Le montant dépasse la dette du client')).toBeInTheDocument()

    await user.clear(amount)
    await user.type(amount, '20000')
    await user.click(within(modal).getByRole('button', { name: 'Encaisser' }))

    expect(await screen.findByText(/Règlement encaissé : nouvelle dette 10 000 FCFA/)).toBeInTheDocument()
    expect(lastRequest('POST', '/api/customers/cu-awa/payments')).toMatchObject({
      body: { shopId: 'shop-1', paymentMethodId: mobileMethod.id, amount: '20000', reference: null },
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('relevé sur la période : soldes d’ouverture et de clôture', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/customers/cu-awa', { session: cashier })

    await user.click(await screen.findByRole('tab', { name: 'Relevé' }))
    expect(await screen.findByText('Solde d’ouverture')).toBeInTheDocument()
    expect(screen.getByText('BTQ1-T-2026-000012')).toBeInTheDocument()
    expect(lastRequest('GET', '/api/customers/cu-awa/statement')?.search).toMatch(/from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}/)
  })
})

describe('Impayés', () => {
  it('ancienneté de la dette, la plus ancienne mise en évidence', async () => {
    setup()
    renderApp('/debtors', { session: manager })

    const row = (await screen.findByText('Awa Ndiaye')).closest('tr')!
    expect(within(row).getByText('20 000 FCFA')).toHaveClass('text-red-600')
    // (les colonnes 0-30, 31-60 et 61-90 jours ne s'affichent que sur un écran moyen ou large)
    expect(screen.getAllByText('30 000 FCFA').length).toBeGreaterThan(0)
  })

  it('réservés à reports.view', async () => {
    setup()
    renderApp('/', { session: cashier })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Clients')).toBeInTheDocument()
    expect(within(menu).queryByText('Impayés')).not.toBeInTheDocument()
  })
})
