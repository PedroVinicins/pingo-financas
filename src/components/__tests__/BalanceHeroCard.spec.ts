import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BalanceHeroCard from '../BalanceHeroCard.vue'

const baseProps = {
  month: 'AGO DE 2026',
  income: 'R$ 0,00',
  expense: 'R$ 0,00',
}

describe('BalanceHeroCard', () => {
  it('mantém todos os dígitos visíveis e reduz saldos compridos', () => {
    const wrapper = mount(BalanceHeroCard, {
      props: { ...baseProps, balance: 'R$ 123.456.789,00' },
    })
    const balance = wrapper.get('h2')

    expect(balance.text()).toBe('R$ 123.456.789,00')
    expect(balance.classes()).not.toContain('truncate')
    expect(balance.classes()).toContain('whitespace-nowrap')
    expect(balance.attributes('style')).toContain('font-size: clamp(1.65rem, 6.5vw, 2.8rem)')
  })

  it('explica o saldo de fechamento ao consultar um mês antigo', () => {
    const wrapper = mount(BalanceHeroCard, {
      props: {
        ...baseProps,
        balance: 'R$ 125,50',
        balanceLabel: 'Você terminou esse mês com esse saldo',
      },
    })

    expect(wrapper.text()).toContain('Você terminou esse mês com esse saldo')
    expect(wrapper.text()).toContain('R$ 125,50')
  })
})
