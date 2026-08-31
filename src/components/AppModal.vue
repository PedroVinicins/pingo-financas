<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  as?: 'div' | 'form' | 'section'
  ariaLabel?: string
  ariaLabelledby?: string
  closeable?: boolean
  panelClass?: string
  panelStyle?: Record<string, string>
  rootClass?: string
  rootStyle?: Record<string, string>
  role?: 'dialog' | 'alertdialog'
}>(), {
  as: 'section',
  ariaLabel: undefined,
  ariaLabelledby: undefined,
  closeable: true,
  panelClass: '',
  panelStyle: () => ({}),
  rootClass: '',
  rootStyle: () => ({}),
  role: 'dialog',
})

const emit = defineEmits<{
  close: []
  submit: [event: SubmitEvent]
}>()

const attrs = useAttrs()
const panel = ref<HTMLElement | null>(null)
const teleportDisabled = import.meta.env.MODE === 'test'
const modalId = Symbol('pingo-modal')
let previouslyFocused: HTMLElement | null = null

const modalStack: symbol[] = ((window as typeof window & { __pingoModalStack?: symbol[] }).__pingoModalStack ??= [])
const isTopModal = () => modalStack.at(-1) === modalId
const panelClasses = computed(() => ['modal-box', 'pingo-modal-panel', props.panelClass])

function requestClose() {
  if (props.closeable && isTopModal()) emit('close')
}

function onBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) requestClose()
}

function onSubmit(event: Event) {
  event.preventDefault()
  emit('submit', event as SubmitEvent)
}

function focusableElements() {
  if (!panel.value) return []
  return Array.from(panel.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
}

function onKeydown(event: KeyboardEvent) {
  if (!isTopModal()) return
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusableElements()
  if (!elements.length) {
    event.preventDefault()
    panel.value?.focus()
    return
  }
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modalStack.push(modalId)
  document.body.classList.add('pingo-modal-open')
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  const preferred = panel.value?.querySelector<HTMLElement>('[autofocus], [data-modal-autofocus]')
  ;(preferred ?? focusableElements()[0] ?? panel.value)?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  const index = modalStack.lastIndexOf(modalId)
  if (index >= 0) modalStack.splice(index, 1)
  if (!modalStack.length) document.body.classList.remove('pingo-modal-open')
  document.removeEventListener('keydown', onKeydown)
  previouslyFocused?.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body" :disabled="teleportDisabled">
    <div
      class="modal modal-open pingo-modal-backdrop"
      :class="rootClass"
      :style="rootStyle"
      v-bind="attrs"
      @click="onBackdrop"
    >
      <component
        :is="as"
        ref="panel"
        :class="panelClasses"
        :style="panelStyle"
        :role="role"
        aria-modal="true"
        :aria-label="ariaLabel"
        :aria-labelledby="ariaLabelledby"
        tabindex="-1"
        @submit="onSubmit"
      >
        <slot />
      </component>
    </div>
  </Teleport>
</template>
