import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuickExpenseSheet from '../QuickExpenseSheet.vue'
import type { Category } from '../../types/finance'

const categoryNames = [
  'Alimentação', 'Casa', 'Compras', 'Contas', 'Educação', 'Escola', 'Higiene', 'Poupança',
]
const categories: Category[] = categoryNames.map((name, index) => ({
  id: `category-${index}`,
  kind: 'expense',
  name,
  icon: 'tag',
  color: '#10B981',
  createdAt: '2026-08-23T12:00:00Z',
}))

describe('QuickExpenseSheet', () => {
  it('permite selecionar categorias além das cinco primeiras', async () => {
    const wrapper = mount(QuickExpenseSheet, {
      props: { categories, cards: [] },
      global: { plugins: [createPinia()] },
    })

    const category = wrapper.findAll('button').find((button) => button.text() === 'Poupança')
    expect(category).toBeDefined()
    await category?.trigger('click')
    await wrapper.get('input[placeholder="0,00"]').setValue('10,00')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      amount: '10.00',
      categoryId: 'category-7',
    })
  })
})
