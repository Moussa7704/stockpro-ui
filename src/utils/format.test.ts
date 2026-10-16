import { describe, expect, it } from 'vitest'
import { formatAmount, formatDate, formatMoney, formatQuantity } from './format'

const NBSP = ' '

describe('formatage', () => {
  it('montants FCFA : milliers séparés, sans décimales, sans flottants', () => {
    expect(formatAmount('1500.00')).toBe(`1${NBSP}500`)
    expect(formatAmount('1234567890.00')).toBe(`1${NBSP}234${NBSP}567${NBSP}890`)
    expect(formatAmount('0.00')).toBe('0')
    expect(formatAmount('-2500.00')).toBe(`-2${NBSP}500`)
    expect(formatAmount(null)).toBe('')
    expect(formatMoney('1500.00')).toBe(`1${NBSP}500${NBSP}FCFA`)
  })

  it('autre devise : deux décimales à la française', () => {
    expect(formatAmount('1500.5', 'EUR')).toBe(`1${NBSP}500,50`)
    expect(formatMoney('12.00', 'EUR')).toBe(`12,00${NBSP}EUR`)
  })

  it('quantités : décimales inutiles retirées, virgule française', () => {
    expect(formatQuantity('2.500')).toBe('2,5')
    expect(formatQuantity('3.000')).toBe('3')
    expect(formatQuantity('10')).toBe('10')
  })

  it('dates : un jour seul ne bascule jamais la veille', () => {
    expect(formatDate('2026-10-16')).toBe('16 oct. 2026')
    expect(formatDate('')).toBe('')
    expect(formatDate('pas une date')).toBe('')
  })
})
