import { describe, expect, it } from 'vitest'
import {
  completeLocalizedDecimalInput,
  formatLocalizedDecimalInput,
  localizedDecimalToStorage,
  storageDecimalToLocalized,
} from '../localizedNumber'

describe('localizedNumber', () => {
  it('insere separadores de milhar sem perder a vírgula decimal', () => {
    expect(formatLocalizedDecimalInput('1234,5')).toBe('1.234,5')
    expect(formatLocalizedDecimalInput('R$ 12.345,678')).toBe('12.345,67')
  })

  it('completa centavos ao sair do campo', () => {
    expect(completeLocalizedDecimalInput('1250')).toBe('1.250,00')
    expect(completeLocalizedDecimalInput('9,5')).toBe('9,50')
  })

  it('converte o formato brasileiro para o formato persistido', () => {
    expect(localizedDecimalToStorage('1.234,56')).toBe('1234.56')
    expect(storageDecimalToLocalized('1234.5')).toBe('1.234,50')
  })
})
