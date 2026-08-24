import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AddDebitCardModal from '../AddDebitCardModal.vue'
import AddDigitalWalletItemModal from '../AddDigitalWalletItemModal.vue'

describe('modais de criação da carteira', () => {
  it('bloqueia reenvios do cartão de débito enquanto salva e exibe a falha da persistência', async () => {
    const wrapper = mount(AddDebitCardModal, {
      props: {
        existingCardsCount: 0,
        busy: true,
        saveError: 'Banco de dados indisponível.',
      },
    })

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('Banco de dados indisponível.')
    expect(wrapper.get('button[type="submit"], form > button:last-child').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Guardando…')
  })

  it('bloqueia reenvios do cartão ao vivo enquanto salva', async () => {
    const wrapper = mount(AddDigitalWalletItemModal, {
      props: { busy: true, saveError: 'Não foi possível gravar o arquivo.' },
    })

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('Não foi possível gravar o arquivo.')
    expect(wrapper.get('form > button:last-child').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Guardando…')
  })
})
