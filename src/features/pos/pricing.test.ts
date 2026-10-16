import { describe, expect, it } from 'vitest'
import { discountPercent, fromCents, priceCart, settle, toCents } from './pricing'

// Cas repris des tests du serveur (sale-pricing) : l'aperçu doit donner exactement les mêmes totaux

describe('aperçu du ticket', () => {
  it('quantité × prix, arrondi au franc (2,5 kg à 333 = 833)', () => {
    const cart = priceCart([{ quantity: '2.5', unitPrice: '333' }], undefined)
    expect(fromCents(cart.total)).toBe('833.00')
  })

  it('remise de ligne en montant et en pourcentage', () => {
    const cart = priceCart(
      [
        { quantity: '2', unitPrice: '1500', discount: { type: 'amount', value: '500' } },
        { quantity: '1', unitPrice: '800', discount: { type: 'percent', value: '10' } },
      ],
      undefined,
    )
    expect(cart.lines.map((line) => fromCents(line.total))).toEqual(['2500.00', '720.00'])
    expect(fromCents(cart.subtotal)).toBe('3800.00')
    expect(fromCents(cart.discountTotal)).toBe('580.00')
    expect(fromCents(cart.total)).toBe('3220.00')
  })

  it('remise du ticket répartie au prorata, la dernière ligne prend le reste (pas de franc perdu)', () => {
    const cart = priceCart(
      [
        { quantity: '1', unitPrice: '1000' },
        { quantity: '1', unitPrice: '1000' },
        { quantity: '1', unitPrice: '1000' },
      ],
      { type: 'amount', value: '100' },
    )
    // 33 + 33 + 34 = 100
    expect(cart.lines.map((line) => line.discount / 100)).toEqual([33, 33, 34])
    expect(fromCents(cart.total)).toBe('2900.00')
  })

  it('remise supérieure au montant : signalée (le serveur refuserait)', () => {
    const cart = priceCart([{ quantity: '1', unitPrice: '1000', name: 'Riz', discount: { type: 'amount', value: '1500' } }], undefined)
    expect(cart.error).toBe('« Riz » : la remise dépasse le montant')
  })

  it('pourcentage de remise du ticket (plafond des caissiers)', () => {
    const cart = priceCart([{ quantity: '1', unitPrice: '10000' }], { type: 'percent', value: '15' })
    expect(discountPercent(cart)).toBe(15)
  })
})

describe('règlement', () => {
  it('espèces : monnaie rendue', () => {
    expect(settle(toCents('4500'), [{ amount: '5000', isCash: true }])).toEqual({ paid: toCents('5000'), change: toCents('500'), balanceDue: 0, error: null })
  })

  it('paiement mixte : Mobile Money + espèces, rendu pris sur les espèces', () => {
    const result = settle(toCents('4500'), [
      { amount: '3000', isCash: false },
      { amount: '2000', isCash: true },
    ])
    expect(result.change).toBe(toCents('500'))
    expect(result.error).toBeNull()
  })

  it('trop-perçu sans espèces : refusé', () => {
    expect(settle(toCents('4500'), [{ amount: '5000', isCash: false }]).error).toMatch(/seules les espèces/)
  })

  it('paiement partiel : reste dû (crédit)', () => {
    expect(settle(toCents('4500'), [{ amount: '1500', isCash: true }]).balanceDue).toBe(toCents('3000'))
  })
})
