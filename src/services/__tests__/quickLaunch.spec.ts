import { describe, expect, it } from 'vitest'
import { parseQuickLaunchUrl, quickExpenseLink } from '../quickLaunch'

describe('quick launch', () => {
  it('abre o lançamento rápido por deep link', () => {
    expect(parseQuickLaunchUrl('pingo://expense')).toEqual({ type: 'expense', cardId: undefined })
  })

  it('pré-seleciona o cartão do atalho', () => {
    expect(parseQuickLaunchUrl('pingo://expense?card=abc')).toEqual({ type: 'expense', cardId: 'abc' })
    expect(quickExpenseLink('abc')).toBe('pingo://expense?card=abc')
  })

  it('aceita fallback web', () => {
    expect(parseQuickLaunchUrl('https://localhost/?quick=expense&card=123')).toEqual({ type: 'expense', cardId: '123' })
  })
})
