import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaLightbox from '../MediaLightbox.vue'

describe('MediaLightbox', () => {
  it('shows the original image and closes from the explicit button', async () => {
    const wrapper = mount(MediaLightbox, {
      props: { src: 'data:image/png;base64,AA==', title: 'Ingresso principal' },
      attachTo: document.body,
      global: { stubs: { Teleport: true } },
    })
    expect(document.body.querySelector('img')?.getAttribute('src')).toContain('data:image/png')
    const close = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Fechar imagem')
    await close?.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
