import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AddTransactionModal from '../AddTransactionModal.vue'
import type { Category } from '../../types/finance'

const expenseCategory: Category = {
  id: 'internet',
  kind: 'expense',
  name: 'Internet',
  icon: 'wifi',
  color: '#7C3AED',
  createdAt: '2026-08-12T12:00:00Z',
}

describe('AddTransactionModal', () => {
  it('cria uma regra do Piloto Mensal sem lançar uma transação imediata', async () => {
    const wrapper = mount(AddTransactionModal, {
      props: { categories: [expenseCategory], cards: [] },
      global: { plugins: [createPinia()] },
    })

    const pilotButton = wrapper.findAll('button').find((button) => button.text().includes('Piloto mensal'))
    expect(pilotButton).toBeDefined()
    await pilotButton?.trigger('click')

    await wrapper.get('input[placeholder="0,00"]').setValue('129,90')
    await wrapper.get('input[placeholder="Ex.: Internet ou Netflix"]').setValue('Internet')
    const dueDay = wrapper.findAll('select').find((select) => select.text().includes('Escolha o vencimento'))
    expect(dueDay).toBeDefined()
    await dueDay?.setValue('20')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('saveRecurring')?.[0]?.[0]).toEqual({
      kind: 'expense',
      amount: '129.90',
      dayOfMonth: 20,
      categoryId: 'internet',
      debitCardId: null,
      description: 'Internet',
      reminderEnabled: true,
    })
  })
})
