import { screen } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { useActiveShop } from '../hook/useActiveShop'
import { meResponse, shopsFixture } from '../test/fixtures'
import { renderWithProviders } from '../test/render'
import { server } from '../test/server'
import { createAppStore } from './index'
import { activeShopChanged, loadShopState, SHOP_STORAGE_KEY } from './shopSlice'

function ActiveShopName() {
  const { activeShop } = useActiveShop()
  return <span>{activeShop ? `Boutique active : ${activeShop.name}` : 'Aucune'}</span>
}

describe('boutique active', () => {
  it('mémorisée par entreprise dans le navigateur, et relue au démarrage', () => {
    const store = createAppStore()
    store.dispatch(activeShopChanged({ companyId: 'company-1', shopId: 'shop-2' }))

    expect(JSON.parse(localStorage.getItem(SHOP_STORAGE_KEY)!)).toEqual({ 'company-1': 'shop-2' })
    expect(createAppStore().getState().shop.byCompany).toEqual({ 'company-1': 'shop-2' })
  })

  it('stockage illisible : on repart de zéro sans planter', () => {
    localStorage.setItem(SHOP_STORAGE_KEY, '{pas du json')
    expect(loadShopState()).toEqual({ byCompany: {} })
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify({ 'company-1': 42 }))
    expect(loadShopState()).toEqual({ byCompany: {} })
  })

  it('reprend la boutique mémorisée si elle est toujours accessible, sinon la première', async () => {
    server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))

    renderWithProviders(<ActiveShopName />, { session: meResponse(), shop: { byCompany: { 'company-1': 'shop-2' } } })
    expect(await screen.findByText('Boutique active : Boutique Marché')).toBeInTheDocument()
  })

  it('boutique mémorisée retirée du périmètre : retombe sur la première', async () => {
    server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))

    renderWithProviders(<ActiveShopName />, { session: meResponse(), shop: { byCompany: { 'company-1': 'shop-supprimee' } } })
    expect(await screen.findByText('Boutique active : Boutique Centre')).toBeInTheDocument()
  })
})
