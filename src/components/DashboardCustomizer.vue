<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { ArrowDown, ArrowUp, GripVertical, LayoutGrid, RotateCcw, X } from 'lucide-vue-next'
import { cloneDashboardLayout, DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_LAYOUT } from '../services/dashboardLayout'
import type { DashboardLayout } from '../types/finance'

const props = defineProps<{ layout: DashboardLayout }>()
const emit = defineEmits<{ close: []; save: [layout: DashboardLayout] }>()
const draft = ref(cloneDashboardLayout(props.layout))
const dragging = ref<number | null>(null)

function move(from: number, to: number) {
  if (to < 0 || to >= draft.value.widgets.length || from === to) return
  const [item] = draft.value.widgets.splice(from, 1)
  draft.value.widgets.splice(to, 0, item)
  dragging.value = to
}
function dragStart(index: number, event: DragEvent) {
  dragging.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function drop(index: number, event: DragEvent) {
  const from = Number(event.dataTransfer?.getData('text/plain'))
  if (Number.isInteger(from)) move(from, index)
  dragging.value = null
}
function pointerStart(index: number, event: PointerEvent) {
  if (event.pointerType === 'mouse') return
  dragging.value = index
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', pointerMove, { passive: false })
  window.addEventListener('pointerup', pointerEnd, { once: true })
}
function pointerMove(event: PointerEvent) {
  if (dragging.value === null) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-widget-index]')
  const to = Number(target?.dataset.widgetIndex)
  if (Number.isInteger(to) && to !== dragging.value) move(dragging.value, to)
}
function pointerEnd() {
  dragging.value = null
  window.removeEventListener('pointermove', pointerMove)
}
function reset() { draft.value = cloneDashboardLayout(DEFAULT_DASHBOARD_LAYOUT); void nextTick() }
onBeforeUnmount(() => window.removeEventListener('pointermove', pointerMove))
</script>

<template>
  <div class="fixed inset-0 z-[85] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <section class="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-xl sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dashboard-customizer-title">
      <div class="flex items-start justify-between gap-3"><div class="flex gap-3"><div class="grid size-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950"><LayoutGrid :size="21" /></div><div><p class="text-sm font-bold text-emerald-600">Seu resumo, do seu jeito</p><h2 id="dashboard-customizer-title" class="text-xl font-black">Personalizar tela principal</h2></div></div><button class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="19" /></button></div>
      <p class="mt-4 text-sm text-slate-500">Arraste pelo puxador para mudar a ordem, escolha o tamanho e desligue o que não quer ver.</p>
      <div class="mt-4 grid gap-2"><article v-for="(widget, index) in draft.widgets" :key="widget.id" :data-widget-index="index" class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-3 transition" :class="dragging === index ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/25' : 'border-slate-200 dark:border-slate-800'" @dragover.prevent @drop="drop(index, $event)"><button draggable="true" class="grid size-10 touch-none place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800" type="button" aria-label="Arrastar cartão" @dragstart="dragStart(index, $event)" @dragend="dragging = null" @pointerdown="pointerStart(index, $event)"><GripVertical :size="19" /></button><div class="min-w-0"><label class="flex cursor-pointer items-center gap-2"><input v-model="widget.visible" type="checkbox" class="size-4 accent-emerald-600" /><strong class="truncate text-sm">{{ DASHBOARD_WIDGETS[widget.id].label }}</strong></label><p class="mt-1 truncate text-xs text-slate-500">{{ DASHBOARD_WIDGETS[widget.id].description }}</p></div><div class="grid gap-1"><select v-model="widget.size" class="rounded-xl border border-slate-200 bg-transparent px-2 py-2 text-xs font-bold dark:border-slate-700" aria-label="Tamanho"><option value="small">Pequeno</option><option value="medium">Médio</option><option value="large">Grande</option></select><div class="flex justify-end"><button type="button" class="grid size-7 place-items-center text-slate-400" :disabled="index === 0" aria-label="Subir" @click="move(index, index - 1)"><ArrowUp :size="14" /></button><button type="button" class="grid size-7 place-items-center text-slate-400" :disabled="index === draft.widgets.length - 1" aria-label="Descer" @click="move(index, index + 1)"><ArrowDown :size="14" /></button></div></div></article></div>
      <div class="mt-5 grid grid-cols-2 gap-2"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-black dark:border-slate-700" @click="reset"><RotateCcw :size="16" /> Usar padrão</button><button class="rounded-2xl bg-emerald-400 py-3 text-sm font-black text-emerald-950" @click="emit('save', draft)">Salvar painel</button></div>
    </section>
  </div>
</template>
