import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface KeyboardViewportMetrics {
  height: number
  offsetTop: number
  keyboardHeight: number
}

export function calculateKeyboardViewport(
  layoutHeight: number,
  viewport?: Pick<VisualViewport, 'height' | 'offsetTop'> | null,
): KeyboardViewportMetrics {
  if (!viewport) return { height: layoutHeight, offsetTop: 0, keyboardHeight: 0 }
  const height = Math.max(1, Math.round(viewport.height))
  const offsetTop = Math.max(0, Math.round(viewport.offsetTop))
  return {
    height,
    offsetTop,
    keyboardHeight: Math.max(0, Math.round(layoutHeight - viewport.height - viewport.offsetTop)),
  }
}

/**
 * Mantém uma única referência de viewport para todos os bottom sheets. O
 * Android WebView nem sempre atualiza `dvh` enquanto o teclado está aberto;
 * `visualViewport` é a medida que acompanha a área realmente visível.
 */
export function installMobileModalViewportSync() {
  const root = document.documentElement
  const update = () => {
    const metrics = calculateKeyboardViewport(window.innerHeight, window.visualViewport)
    root.style.setProperty('--pingo-modal-viewport-top', `${metrics.offsetTop}px`)
    root.style.setProperty('--pingo-modal-viewport-height', `${metrics.height}px`)
  }
  const keepFocusedFieldVisible = (event: FocusEvent) => {
    if (!window.matchMedia('(max-width: 639px)').matches) return
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.closest('.pingo-modal-panel')) return
    if (!target.matches('input, textarea, select, [contenteditable="true"]')) return
    window.setTimeout(() => {
      target.scrollIntoView?.({
        block: 'center',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }, 180)
  }

  update()
  window.addEventListener('resize', update)
  window.visualViewport?.addEventListener('resize', update)
  window.visualViewport?.addEventListener('scroll', update)
  document.addEventListener('focusin', keepFocusedFieldVisible)
  return () => {
    window.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    document.removeEventListener('focusin', keepFocusedFieldVisible)
  }
}

export function useKeyboardAwareModal() {
  const overlayStyle = ref<Record<string, string>>({})
  const contentStyle = ref<Record<string, string>>({})

  function updateViewport() {
    const metrics = calculateKeyboardViewport(window.innerHeight, window.visualViewport)
    overlayStyle.value = {
      top: `${metrics.offsetTop}px`,
      bottom: 'auto',
      height: `${metrics.height}px`,
    }
    contentStyle.value = { maxHeight: `${Math.max(0, metrics.height - 12)}px` }
  }

  function keepFocusedFieldVisible(event: FocusEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    window.setTimeout(() => {
      target.scrollIntoView?.({
        block: 'center',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }, 180)
  }

  onMounted(() => {
    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewport)
    window.visualViewport?.removeEventListener('resize', updateViewport)
    window.visualViewport?.removeEventListener('scroll', updateViewport)
  })

  return { overlayStyle, contentStyle, keepFocusedFieldVisible }
}
