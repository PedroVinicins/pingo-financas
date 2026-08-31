import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import AppModal from '../AppModal.vue'

describe('AppModal', () => {
  it('fecha pelo fundo e pela tecla Escape', async () => {
    const wrapper = mount(AppModal, {
      props: { ariaLabel: 'Modal de teste' },
      slots: { default: '<button>Continuar</button>' },
    })

    await wrapper.get('.pingo-modal-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(2)
    wrapper.unmount()
  })

  it('mantém modais ocupados protegidos contra fechamento acidental', async () => {
    const wrapper = mount(AppModal, {
      props: { ariaLabel: 'Modal ocupado', closeable: false },
      slots: { default: '<button>Processando</button>' },
    })

    await wrapper.get('.pingo-modal-backdrop').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})
