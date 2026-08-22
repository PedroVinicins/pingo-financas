import { describe, expect, it } from 'vitest'
import { currencySymbol, formatCurrencyCents, formatCurrencyValue, privateCurrencyCents } from '../currency'

describe('currency', () => {
  it('formats every supported currency using Brazilian decimal separators', () => {
    expect(formatCurrencyValue('1234.56', 'BRL')).toContain('1.234,56')
    expect(formatCurrencyValue('1234.56', 'USD')).toContain('1.234,56')
    expect(formatCurrencyValue('1234.56', 'EUR')).toContain('1.234,56')
    expect(formatCurrencyCents(123456n, 'EUR')).toContain('€')
  })

  it('uses the selected symbol while values are private', () => {
    expect(currencySymbol('USD')).toBe('US$')
    expect(privateCurrencyCents(100n, 'USD', true)).toBe('US$ •••••')
  })
})
