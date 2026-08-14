<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'

withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
}>(), {
  confirmLabel: 'Confirmar',
  busy: false,
})

const emit = defineEmits<{ cancel: []; confirm: [] }>()
const cancelButton = ref<HTMLButtonElement | null>(null)
onMounted(() => cancelButton.value?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[110] grid place-items-end bg-slate-950/55 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" @click.self="!busy && emit('cancel')" @keydown.esc="!busy && emit('cancel')">
      <section class="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div class="flex items-start gap-3">
          <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"><AlertTriangle :size="21" /></div>
          <div class="min-w-0 flex-1"><h2 id="confirm-dialog-title" class="text-xl font-black">{{ title }}</h2><p class="mt-1 text-sm leading-relaxed text-slate-500">{{ message }}</p></div>
          <button :disabled="busy" class="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 disabled:opacity-40" aria-label="Cancelar" @click="emit('cancel')"><X :size="18" /></button>
        </div>
        <div class="mt-6 grid grid-cols-2 gap-2">
          <button ref="cancelButton" :disabled="busy" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black disabled:opacity-40 dark:border-slate-700" @click="emit('cancel')">Cancelar</button>
          <button :disabled="busy" class="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50" @click="emit('confirm')">{{ busy ? 'Aguarde…' : confirmLabel }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
