<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import AppModal from './AppModal.vue'

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
  <AppModal role="alertdialog" aria-labelledby="confirm-dialog-title" root-class="z-[110]" panel-class="p-5 sm:max-w-md sm:p-6" :closeable="!busy" @close="emit('cancel')">
        <div class="flex items-start gap-3">
          <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"><AlertTriangle :size="21" /></div>
          <div class="min-w-0 flex-1"><h2 id="confirm-dialog-title" class="text-xl font-black">{{ title }}</h2><p class="mt-1 text-sm leading-relaxed text-slate-500">{{ message }}</p></div>
          <button :disabled="busy" class="pingo-modal-close" aria-label="Cancelar" @click="emit('cancel')"><X :size="18" /></button>
        </div>
        <div class="pingo-modal-footer mt-6 grid grid-cols-2 gap-2">
          <button ref="cancelButton" :disabled="busy" class="pingo-modal-secondary" @click="emit('cancel')">Cancelar</button>
          <button :disabled="busy" class="btn min-h-12 rounded-2xl border-0 bg-rose-600 px-4 text-sm font-black text-white disabled:opacity-50" @click="emit('confirm')">{{ busy ? 'Aguarde…' : confirmLabel }}</button>
        </div>
  </AppModal>
</template>
