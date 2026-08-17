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
  const height = Math.max(320, Math.round(viewport.height))
  const offsetTop = Math.max(0, Math.round(viewport.offsetTop))
  return {
    height,
    offsetTop,
    keyboardHeight: Math.max(0, Math.round(layoutHeight - viewport.height - viewport.offsetTop)),
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
    contentStyle.value = { maxHeight: `${Math.max(304, metrics.height - 12)}px` }
  }

  function keepFocusedFieldVisible(event: FocusEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    window.setTimeout(() => {
      target.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
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
