import { describe, expect, it } from 'vitest'
import type { CustomerPayment } from '../../types/customers'
import { buildPaymentReceipt, RECEIPT_WIDTH, receiptNumber } from './paymentReceipt'

const payment: CustomerPayment = {
  id: '9f3c2a1b-77aa-4000-8000-000000000001',
  shopId: 'shop-1',
  amount: '20000.00',
  reference: 'OM-55821',
  cashSessionId: null,
  createdAt: '2026-10-17T14:30:00.000Z',
  paymentMethod: { id: 'pm-momo', code: 'mobile_money', name: 'Mobile Money', type: 'mobile_money' },
  customerBalance: '10000.00',
}
const context = { companyName: 'Commerce 1', shopName: 'Boutique Centre', customerName: 'Awa Ndiaye' }

describe('Reçu de règlement', () => {
  it('juste après l’encaissement : montant reçu et dette restante, alignés sur 42 colonnes', () => {
    const text = buildPaymentReceipt(payment, { ...context, justPaid: true })

    expect(text).toContain('REÇU DE RÈGLEMENT')
    expect(text).toContain('R-9F3C2A1B')
    expect(text).toContain('Client : Awa Ndiaye')
    expect(text).toContain('Moyen : Mobile Money')
    expect(text).toContain('Référence : OM-55821')
    expect(text).toMatch(/^Montant reçu +20 000 FCFA$/m)
    expect(text).toMatch(/^Dette restante +10 000 FCFA$/m)
    expect(text.split('\n').every((line) => line.length <= RECEIPT_WIDTH)).toBe(true)
    // Aucun espace insécable : l'alignement tient à l'impression
    expect(text).not.toMatch(/[\u00a0\u202f]/)
  })

  it('en réimpression : la dette est celle du jour, datée', () => {
    const text = buildPaymentReceipt(payment, { ...context, justPaid: false, printedAt: new Date('2026-10-20T09:00:00Z') })

    expect(text).not.toContain('Dette restante')
    expect(text).toMatch(/^Dette au 20 oct\. 2026 +10 000 FCFA$/m)
  })

  it('sans référence ni boutique connue : lignes omises', () => {
    const text = buildPaymentReceipt({ ...payment, reference: null }, { ...context, shopName: undefined, justPaid: true })

    expect(text).not.toContain('Référence')
    expect(text).not.toContain('Boutique Centre')
    expect(receiptNumber('ab-cd-ef12-3456')).toBe('R-ABCDEF12')
  })
})
